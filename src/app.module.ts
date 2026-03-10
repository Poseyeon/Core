import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { MimoModule } from './mimo/mimo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigService available globally
    }),
    DatabaseModule,
    UsersModule,
    MimoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
