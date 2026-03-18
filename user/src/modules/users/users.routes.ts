import {Router} from 'express';
import {UsersController} from './users.controller.js';
import {UsersService} from './users.service.js';
import type {UserRepository} from './users.repository.js';
import {validate} from '../../shared/middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  paginationSchema,
  userIdParamSchema,
} from './users.schema.js';

export function createUsersRoutes(repo: UserRepository) {
  const service = new UsersService(repo);
  const controller = new UsersController(service);

  const usersRouter = Router();
  usersRouter.get('/', validate(paginationSchema, 'query'), controller.listUsers);
  usersRouter.get('/:id', validate(userIdParamSchema, 'params'), controller.getUserById);
  usersRouter.post('/', validate(createUserSchema, 'body'), controller.createUser);
  usersRouter.patch(
    '/:id',
    validate(userIdParamSchema, 'params'),
    validate(updateUserSchema, 'body'),
    controller.updateUser
  );
  usersRouter.delete('/:id', validate(userIdParamSchema, 'params'), controller.deleteUser);

  const userInfoRouter = Router();
  userInfoRouter.get('/:id/info', validate(userIdParamSchema, 'params'), controller.getUserInfo);

  return {usersRouter, userInfoRouter};
}
