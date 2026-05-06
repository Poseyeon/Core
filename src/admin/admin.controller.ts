import { Controller, Get, Delete, Post, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'System statistics' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getStats() {
    return this.adminService.getAdminStats();
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete a user by ID (Admin only)' })
  @ApiParam({ name: 'userId', type: Number, example: 42 })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('userId', ParseIntPipe) userId: number) {
    const result = await this.adminService.deleteUser(userId);
    if (!result.success) {
      return result;
    }
    return result;
  }

  @Post('users/:userId/reset-password')
  @ApiOperation({ summary: "Reset a user's password (Admin only)" })
  @ApiParam({ name: 'userId', type: Number, example: 42 })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.adminService.resetPassword(userId, resetPasswordDto.newPassword);
  }
}
