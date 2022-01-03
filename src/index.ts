import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import mikroOrmConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
// import redis from "redis";
const redis = require("redis");
import session from "express-session";
import connectRedis from "connect-redis";
import { __prod__ } from "./constants";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import cors from "cors";

const main = async () => {
  const orm = await MikroORM.init(mikroOrmConfig); // connect db
  await orm.getMigrator().up(); // run migration

  const app = express();

  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  app.use(
    cors({
      origin: ["http://localhost:3000", "https://studio.apollographql.com"],
      credentials: true,
    })
  );
  app.use(
    session({
      name: "qid",
      store: new RedisStore({
        client: redisClient as any,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        sameSite: "lax",
        secure: __prod__,
      },
      saveUninitialized: false,
      secret: "adfadsfasdfqweqw",
      resave: false,
    })
  );
  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ em: orm.em, req, res }),
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
  });

  app.get("/", (_, res) => {
    res.send("hello");
  });
  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    cors: false, // { credentials: true, origin: "https://studio.apollographql.com" },
  });

  app.listen(4000, () => {
    console.log("Listening on port http://localhost:4000");
    console.log("http://localhost:4000/graphql");
  });
  //   const post = orm.em.create(Post, { title: "first post" });
  //   await orm.em.persistAndFlush(post);
  //   const posts = await orm.em.find(Post, {})
  //   console.log(posts);
};

main().catch((err) => {
  console.log(err);
});
