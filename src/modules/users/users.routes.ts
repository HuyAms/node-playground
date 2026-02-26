import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { userRepository } from './users.repository.js';
import { validate } from '../../shared/middleware/validate.js';
import { createUserSchema, updateUserSchema, paginationSchema, userIdParamSchema } from './users.schema.js';

const service = new UsersService(userRepository);
const controller = new UsersController(service);

export const usersRouter = Router();

usersRouter.get('/', validate(paginationSchema, 'query'), controller.listUsers);
usersRouter.get('/:id', validate(userIdParamSchema, 'params'), controller.getUserById);
usersRouter.post('/', validate(createUserSchema, 'body'), controller.createUser);
usersRouter.patch('/:id', validate(userIdParamSchema, 'params'), validate(updateUserSchema, 'body'), controller.updateUser);
usersRouter.delete('/:id', validate(userIdParamSchema, 'params'), controller.deleteUser);
