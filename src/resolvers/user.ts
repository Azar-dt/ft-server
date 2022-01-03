import argon from "argon2";
import { User } from "../entities/User";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { MyContext } from "../types";

@InputType()
class UsernamePassword {
  @Field()
  username: string;

  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: [FieldError];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, {nullable: true})
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session.userId) return null;
    const user = await em.findOne(User, {id: req.session.userId});
    return user;
  }
  
  @Query(() => [User])
  async getUsers(@Ctx() { em }: MyContext) {
    return em.find(User, {});
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePassword,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            message: "length must be greater than 2",
          },
        ],
      };
    }
    if (options.password.length <= 2) {
      return {
        errors: [
          {
            field: "password",
            message: "length must be greater than 2",
          },
        ],
      };
    }
    const hashedPassword = await argon.hash(options.password);

    const user = await em.create(User, {
      username: options.username,
      password: hashedPassword,
    });
    try {
      await em.persistAndFlush(user);
    } catch (err) {
      // console.log(err);
      if (err.code === "23505")
        return {
          errors: [
            {
              field: "username",
              message: "username has already taken",
            },
          ],
        };
    }
    return {
      user: user,
    };
  }

  @Mutation(() => UserResponse, { nullable: true })
  async login(
    @Arg("options") options: UsernamePassword,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse | null> {
    const user = await em.findOne(User, { username: options.username });
    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "username doesn't exist",
          },
        ],
      };
    }

    const isValid = await argon.verify(user.password, options.password);
    if (!isValid)
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password",
          },
        ],
      };
      // store userId in session
      req.session.userId = user.id;
      console.log(req.session);
      
    return {
      user: user,
    };
  }

  @Mutation(() => User, { nullable: true })
  async deleteUser(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<User | null> {
    const user = await em.findOne(User, { id });
    if (!user) return null;
    await em.nativeDelete(User, { id });
    return user;
  }

 
}
