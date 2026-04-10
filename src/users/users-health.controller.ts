import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller()
export class UsersHealthController {
  constructor(private readonly usersService: UsersService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok', port: 3000 } } })
  health() {
    return this.usersService.getHealth();
  }
}

