import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { LoginUserDto } from './dto/login-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetupDto } from './dto/setup.dto';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('Users')
@Controller('api') // Setting a base path for all routes in this controller
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.usersService.login(loginUserDto);
  }

  @Post('users')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Post('setup')
  async setup(@Body() setupDto: SetupDto) {
    return this.usersService.setup(setupDto);
  }

  @Get('profile-picture/:userId')
  @ApiOperation({ summary: 'Get profile picture by user ID' })
  @ApiParam({ name: 'userId', type: Number, example: 42 })
  @ApiResponse({ status: 200, description: 'JPEG image bytes' })
  @ApiResponse({ status: 404, description: 'Profile picture not found' })
  async getProfilePicture(
    @Param('userId', ParseIntPipe) userId: number,
    @Res() res: Response,
  ) {
    const image = await this.usersService.getProfilePicture(userId);
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(image);
  }

  @Post('profile-picture/:userId')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload or update profile picture by user ID' })
  @ApiParam({ name: 'userId', type: Number, example: 42 })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (png, jpg, jpeg, gif, webp), max 5MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile picture uploaded successfully',
    schema: {
      example: {
        success: true,
        message: 'Profile picture uploaded successfully',
      },
    },
  })
  async uploadProfilePicture(
    @Param('userId', ParseIntPipe) userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.usersService.uploadProfilePicture(userId, file);
  }

  @Get('users/by-username/:username/company/:companyId')
  @ApiOperation({ summary: 'Gets user ID from username and company ID' })
  @ApiParam({ name: 'username', type: String, example: 'NSCHMID' })
  @ApiParam({ name: 'companyId', type: Number, example: 7 })
  @ApiResponse({
    status: 200,
    description: 'User id resolved',
    schema: { example: { success: true, userId: 42 } },
  })
  async getUserId(
    @Param('username') username: string,
    @Param('companyId', ParseIntPipe) companyId: number,
  ) {
    return this.usersService.getUserIdByUsernameAndCompany(username, companyId);
  }

  @Get('users/preview/:userId')
  @ApiOperation({ summary: 'Gets user preview by ID' })
  @ApiParam({ name: 'userId', type: Number, example: 42 })
  @ApiResponse({
    status: 200,
    description: 'User info retrieved',
    schema: {
      example: {
        success: true,
        firstname: 'John',
        surname: 'Doe',
        role: 'Consultant',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.getUserById(userId);
  }

  @Get('users/:userId/is-admin')
  @ApiOperation({ summary: 'Checks if a user is an admin by ID' })
  @ApiParam({ name: 'userId', type: Number, example: 42 })
  @ApiResponse({
    status: 200,
    description: 'Admin status retrieved',
    schema: { example: { success: true, isAdmin: true } },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async checkAdminStatus(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.checkAdminStatus(userId);
  }
}
