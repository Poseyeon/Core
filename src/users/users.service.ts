import { Inject, Injectable, UnauthorizedException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Pool } from 'mysql2/promise';
import { DB_CONNECTION } from '../database/constants';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { SetupDto } from './dto/setup.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_CONNECTION) private readonly pool: Pool,
    private readonly jwtService: JwtService,
  ) {}

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
}