/**
 * Example Controller - OrderController
 * Demonstrates ArchMate's controller detection
 */

import { UserService, User } from '../services/UserService';
import { OrderService } from '../services/OrderService';
import { PaymentService } from '../services/PaymentService';
import { NotificationService } from '../services/NotificationService';
import { Logger } from '../services/UserService';

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface CreateOrderDto {
  userId: string;
  items: OrderItem[];
}

export interface UpdateOrderDto {
  status?: OrderStatus;
  items?: OrderItem[];
}

/**
 * OrderController handles HTTP requests for order operations
 */
@Controller
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly userService: UserService,
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new order
   */
  @Post('/orders')
  async createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    this.logger.info('Creating new order', { userId: dto.userId });

    // Verify user exists
    const user = await this.userService.getUserById(dto.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate total
    const total = dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Create order
    const order = await this.orderService.createOrder({
      userId: dto.userId,
      items: dto.items,
      total,
    });

    // Process payment
    const payment = await this.paymentService.processPayment(order.id, total);

    // Send notification
    await this.notificationService.sendOrderConfirmation(user.email, order.id);

    this.logger.info('Order created successfully', { orderId: order.id });
    return order;
  }

  /**
   * Get order by ID
   */
  @Get('/orders/:id')
  async getOrder(@Param('id') id: string): Promise<Order> {
    const order = await this.orderService.getOrderById(id);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }

  /**
   * List user's orders
   */
  @Get('/users/:userId/orders')
  async listUserOrders(@Param('userId') userId: string): Promise<Order[]> {
    return this.orderService.getOrdersByUserId(userId);
  }

  /**
   * Update order status
   */
  @Patch('/orders/:id')
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto
  ): Promise<Order> {
    const order = await this.orderService.updateOrder(id, dto);

    // Notify on status change
    if (dto.status) {
      const user = await this.userService.getUserById(order.userId);
      if (user) {
        await this.notificationService.sendOrderStatusUpdate(user.email, order.id, dto.status);
      }
    }

    return order;
  }

  /**
   * Cancel an order
   */
  @Delete('/orders/:id')
  async cancelOrder(@Param('id') id: string): Promise<void> {
    const order = await this.orderService.getOrderById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    // Refund if payment was made
    if (order.status !== 'pending') {
      await this.paymentService.refundPayment(order.id);
    }

    await this.orderService.cancelOrder(id);
    this.logger.info('Order cancelled', { orderId: id });
  }
}

// HTTP Decorators (simplified)
export function Controller(path?: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('controllerPath', path || '', target);
  };
}

export function Get(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('httpMethod', 'GET', descriptor.value);
    Reflect.defineMetadata('routePath', path, descriptor.value);
  };
}

export function Post(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('httpMethod', 'POST', descriptor.value);
    Reflect.defineMetadata('routePath', path, descriptor.value);
  };
}

export function Patch(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('httpMethod', 'PATCH', descriptor.value);
    Reflect.defineMetadata('routePath', path, descriptor.value);
  };
}

export function Delete(path: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata('httpMethod', 'DELETE', descriptor.value);
    Reflect.defineMetadata('routePath', path, descriptor.value);
  };
}

export function Param(name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    // Parameter metadata
  };
}

export function Body(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    // Parameter metadata
  };
}
