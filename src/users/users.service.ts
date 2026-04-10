import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Pool } from 'mysql2/promise';
import { DB_CONNECTION } from '../database/constants';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { SetupDto } from './dto/setup.dto';
import * as path from 'path';
import * as fs from 'fs';
import * as sqlite3 from 'sqlite3';
import sharp from 'sharp';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly sqliteDbPath = path.join(
    process.cwd(),
    'core-db',
    'sqlite',
    'data',
    'database.db',
  );

  constructor(
    @Inject(DB_CONNECTION) private readonly pool: Pool,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initAvatarDatabase();
  }

  private async initAvatarDatabase(): Promise<void> {
    const dbDir = path.dirname(this.sqliteDbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS AVATARS (
        USER_ID INTEGER NOT NULL PRIMARY KEY,
        AVATAR_IMAGE BLOB NOT NULL,
        AVATAR_UPLOAD_DATE DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.withSqliteDb((db) => this.runSqlite(db, sql));
  }

  private async withSqliteDb<T>(fn: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const db = new sqlite3.Database(this.sqliteDbPath, async (openErr) => {
        if (openErr) {
          reject(openErr);
          return;
        }
        try {
          const result = await fn(db);
          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
              return;
            }
            resolve(result);
          });
        } catch (err) {
          db.close(() => reject(err));
        }
      });
    });
  }

  private async runSqlite(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async getSqlite<T = any>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row as T | undefined);
      });
    });
  }

  private validateImage(file: Express.Multer.File): void {
    const allowedExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
    const fileName = file.originalname || '';
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

    if (!ext || !allowedExtensions.has(ext)) {
      throw new BadRequestException(
        'File type not allowed. Allowed types: png, jpg, jpeg, gif, webp',
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No file selected');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }
  }

  private async processImage(file: Express.Multer.File): Promise<Buffer> {
    try {
      return await sharp(file.buffer)
        .rotate()
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      throw new BadRequestException(`Invalid image file: ${(err as Error).message}`);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { company, username, password } = loginUserDto;

    try {
      const [rows] = await this.pool.query<any[]>(
        'SELECT USER_ID, USER_ABBR, USER_PASSWORD, USER_SURNAME, USER_FIRST_NAME, USER_ROLE FROM USERS WHERE COMP_ID = ? AND USER_ABBR = ? LIMIT 1',
        [company, username],
      );

      if (rows.length === 0) {
        throw new UnauthorizedException('Invalid company or username');
      }

      const user = rows[0];
      const storedPassword = user.USER_PASSWORD || '';

      const passwordMatches = await bcrypt.compare(password, storedPassword);

      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid password');
      }

      const payload = {
        userId: user.USER_ID,
        company,
        username: user.USER_ABBR,
        surname: user.USER_SURNAME,
        firstName: user.USER_FIRST_NAME,
        role: user.USER_ROLE,
      };

      const token = this.jwtService.sign(payload);

      // The part that sends the token to another service is an external concern
      // and might be handled differently, e.g., via an event or a dedicated service.
      // For now, we focus on the core login logic.

      return {
        success: true,
        redirect: '/dashboard.html',
        userId: user.USER_ID,
        companyId: company,
        username: user.USER_ABBR,
        token: token,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      console.error('Login error:', err);
      throw new InternalServerErrorException('Server error during login');
    }
  }

  async createUser(createUserDto: CreateUserDto) {
    const { companyId, role, firstname, surname, username, password } = createUserDto;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await this.pool.query<any>(
            'INSERT INTO USERS (COMP_ID, USER_ABBR, USER_SURNAME, USER_FIRST_NAME, USER_ROLE, USER_PASSWORD) VALUES (?, ?, ?, ?, ?, ?)',
            [companyId, username, surname, firstname, role, hashedPassword]
        );

        const userId = result.insertId;
        return { success: true, message: 'User created successfully', userId };
    } catch (err) {
        console.error('Create user error:', err);
        throw new InternalServerErrorException('Server error: ' + err.message);
    }
  }

  async setup(setupDto: SetupDto) {
    const { companyName, companyDesc, userAbbr, firstname, surname, role, password, passwordRepeat } = setupDto;

    if (password !== passwordRepeat) {
        throw new BadRequestException('Passwords do not match');
    }

    const conn = await this.pool.getConnection();
    try {
        await conn.beginTransaction();

        const [companyResult] = await conn.query<any>(
            'INSERT INTO COMPANY (COMP_NAME, COMP_DESC) VALUES (?, ?)',
            [companyName, companyDesc]
        );
        const companyId = companyResult.insertId;

        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await conn.query<any>(
            'INSERT INTO USERS (COMP_ID, USER_ABBR, USER_SURNAME, USER_FIRST_NAME, USER_ROLE, USER_PASSWORD) VALUES (?, ?, ?, ?, ?, ?)',
            [companyId, userAbbr, surname, firstname, role, hashedPassword]
        );
        const userId = userResult.insertId;

        await conn.query(
            'UPDATE COMPANY SET COMP_OWNER_ID = ? WHERE COMP_ID = ?',
            [userId, companyId]
        );

        await conn.commit();

        return { success: true, message: 'Setup completed successfully', companyId, userId };
    } catch (err) {
        await conn.rollback();
        console.error('Setup error:', err);
        throw new InternalServerErrorException('Server error: ' + err.message);
    } finally {
        conn.release();
    }
  }

  async getProfilePicture(userId: number): Promise<Buffer> {
    try {
      const imageRow = await this.withSqliteDb(async (db) => {
        return this.getSqlite<{ AVATAR_IMAGE: Buffer }>(
          db,
          'SELECT AVATAR_IMAGE FROM AVATARS WHERE USER_ID = ?',
          [userId],
        );
      });

      if (!imageRow?.AVATAR_IMAGE) {
        throw new NotFoundException('Profile picture not found');
      }
      return imageRow.AVATAR_IMAGE;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new InternalServerErrorException(`Server error: ${(err as Error).message}`);
    }
  }

  async uploadProfilePicture(userId: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateImage(file);
    const imageData = await this.processImage(file);

    try {
      await this.withSqliteDb(async (db) => {
        const existing = await this.getSqlite<{ USER_ID: number }>(
          db,
          'SELECT USER_ID FROM AVATARS WHERE USER_ID = ?',
          [userId],
        );

        if (existing) {
          await this.runSqlite(
            db,
            'UPDATE AVATARS SET AVATAR_IMAGE = ?, AVATAR_UPLOAD_DATE = CURRENT_TIMESTAMP WHERE USER_ID = ?',
            [imageData, userId],
          );
        } else {
          await this.runSqlite(
            db,
            'INSERT INTO AVATARS (USER_ID, AVATAR_IMAGE) VALUES (?, ?)',
            [userId, imageData],
          );
        }
      });

      return { success: true, message: 'Profile picture uploaded successfully' };
    } catch (err) {
      throw new InternalServerErrorException(`Server error: ${(err as Error).message}`);
    }
  }

  async getUserIdByUsernameAndCompany(username: string, companyId: number) {
    try {
      const [rows] = await this.pool.query<any[]>(
        'SELECT USER_ID FROM USERS WHERE USER_ABBR = ? AND COMP_ID = ?',
        [username, companyId],
      );

      if (!rows.length) {
        throw new NotFoundException('User not found');
      }

      return { success: true, userId: rows[0].USER_ID };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new InternalServerErrorException(`Server error: ${(err as Error).message}`);
    }
  }

  getHealth() {
    return { status: 'ok', port: Number(process.env.PORT ?? 3000) };
  }
}