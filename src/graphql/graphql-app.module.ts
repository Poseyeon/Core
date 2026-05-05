import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AssetsModule } from './assets/assets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Schema-first: load types from a standalone .graphql file.
      typePaths: [join(process.cwd(), 'src/graphql/**/*.graphql')],
      path: '/graphql',
      // Uses Apollo's default landing/explorer (no Apollo Playground dependency).
      playground: true,
      sortSchema: true,
    }),
    AssetsModule,
  ],
})
export class GraphqlAppModule {}
