import type {Request, Response, NextFunction} from 'express';
import {Router} from 'express';
import {config} from '../../config.js';
import {delay} from '../../utils/delay.js';
import {UsersController} from './users.controller.js';
import {UsersService} from './users.service.js';
import {userRepository} from './users.repository.js';
import {validate} from '../../shared/middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  paginationSchema,
  userIdParamSchema,
} from './users.schema.js';

async function fakeSlownessMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (config.enableFakeSlowness) {
    await delay(150 + Math.random() * 50);
  }
  next();
}

const service = new UsersService(userRepository);
const controller = new UsersController(service);

export const usersRouter = Router();

usersRouter.use(fakeSlownessMiddleware);

usersRouter.get('/', validate(paginationSchema, 'query'), controller.listUsers);
usersRouter.get('/:id/info', validate(userIdParamSchema, 'params'), controller.getUserInfo);
usersRouter.get('/:id', validate(userIdParamSchema, 'params'), controller.getUserById);
usersRouter.post('/', validate(createUserSchema, 'body'), controller.createUser);
usersRouter.patch(
  '/:id',
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema, 'body'),
  controller.updateUser
);
usersRouter.delete('/:id', validate(userIdParamSchema, 'params'), controller.deleteUser);
