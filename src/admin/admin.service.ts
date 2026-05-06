import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Pool } from 'mysql2/promise';
import { DB_CONNECTION } from '../database/constants';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(@Inject(DB_CONNECTION) private readonly pool: Pool) {}

  async getAllUsers() {
    const [rows] = await this.pool.query(
      'SELECT USER_ID, USER_ABBR, USER_SURNAME, USER_FIRST_NAME, USER_ROLE, IS_ADMIN FROM USERS',
    );
    return rows;
  }

  async getAdminStats() {
    const [userCount] = await this.pool.query('SELECT COUNT(*) as count FROM USERS');
    const [companyCount] = await this.pool.query('SELECT COUNT(*) as count FROM COMPANY');
    
    return {
      totalUsers: (userCount as any)[0].count,
      totalCompanies: (companyCount as any)[0].count,
    };
  }

  async deleteUser(userId: number) {
    const [result] = await this.pool.query<any>(
      'DELETE FROM USERS WHERE USER_ID = ?',
      [userId],
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, message: 'User deleted successfully' };
  }

  async resetPassword(userId: number, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [result] = await this.pool.query<any>(
      'UPDATE USERS SET USER_PASSWORD = ? WHERE USER_ID = ?',
      [hashedPassword, userId],
    );

    if (result.affectedRows === 0) {
      throw new NotFoundException('User not found');
    }

    return { success: true, message: 'Password reset successfully' };
  }
}
