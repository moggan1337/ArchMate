/**
 * Example Service - OrderService
 * Demonstrates service-to-service dependencies
 */

import { Logger } from './UserService';
import { PaymentService } from './PaymentService';

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

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled';

export interface CreateOrderInput {
  userId: string;
  items: OrderItem[];
  total: number;
}

/**
 * OrderService handles order management
 */
@Service
export class OrderService {
  private orders: Map<string, Order> = new Map();

  constructor(
    private readonly logger: Logger,
    private readonly paymentService: PaymentService
  ) {}

  /**
   * Create a new order
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const order: Order = {
      id: this.generateId(),
      userId: input.userId,
      items: input.items,
      total: input.total,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);
    this.logger.info('Order created', { orderId: order.id, userId: order.userId });

    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  /**
   * Get all orders for a user
   */
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    const userOrders: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.userId === userId) {
        userOrders.push(order);
      }
    }
    return userOrders;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = {
      ...order,
      status,
      updatedAt: new Date(),
    };

    this.orders.set(id, updatedOrder);
    this.logger.info('Order status updated', { orderId: id, status });

    return updatedOrder;
  }

  /**
   * Update order
   */
  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = {
      ...order,
      ...updates,
      updatedAt: new Date(),
    };

    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(id: string): Promise<void> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error('Order not found');
    }

    await this.updateOrderStatus(id, 'cancelled');
    this.logger.info('Order cancelled', { orderId: id });
  }

  /**
   * Process order (move to processing status)
   */
  async processOrder(id: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'confirmed') {
      throw new Error('Order must be confirmed before processing');
    }

    return this.updateOrderStatus(id, 'processing');
  }

  /**
   * Ship order
   */
  async shipOrder(id: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'processing') {
      throw new Error('Order must be processing before shipping');
    }

    return this.updateOrderStatus(id, 'shipped');
  }

  /**
   * Deliver order
   */
  async deliverOrder(id: string): Promise<Order> {
    return this.updateOrderStatus(id, 'delivered');
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    const filteredOrders: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.status === status) {
        filteredOrders.push(order);
      }
    }
    return filteredOrders;
  }

  /**
   * Generate unique order ID
   */
  private generateId(): string {
    return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

/**
 * PaymentService handles payment processing
 */
@Service
export class PaymentService {
  private payments: Map<string, Payment> = new Map();

  constructor(private readonly logger: Logger) {}

  /**
   * Process a payment for an order
   */
  async processPayment(orderId: string, amount: number): Promise<Payment> {
    const payment: Payment = {
      id: this.generateId(),
      orderId,
      amount,
      status: 'completed',
      method: 'credit_card',
      processedAt: new Date(),
    };

    this.payments.set(payment.id, payment);
    this.logger.info('Payment processed', { paymentId: payment.id, orderId, amount });

    return payment;
  }

  /**
   * Refund a payment
   */
  async refundPayment(orderId: string): Promise<void> {
    for (const payment of this.payments.values()) {
      if (payment.orderId === orderId && payment.status === 'completed') {
        payment.status = 'refunded';
        this.logger.info('Payment refunded', { paymentId: payment.id });
      }
    }
  }

  /**
   * Get payment for an order
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    for (const payment of this.payments.values()) {
      if (payment.orderId === orderId) {
        return payment;
      }
    }
    return null;
  }

  private generateId(): string {
    return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: string;
  processedAt: Date;
}

/**
 * NotificationService handles user notifications
 */
@Service
export class NotificationService {
  constructor(private readonly logger: Logger) {}

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(email: string, orderId: string): Promise<void> {
    this.logger.info('Sending order confirmation', { email, orderId });
    // Email sending logic would go here
  }

  /**
   * Send order status update
   */
  async sendOrderStatusUpdate(
    email: string, 
    orderId: string, 
    status: string
  ): Promise<void> {
    this.logger.info('Sending order status update', { email, orderId, status });
    // Email sending logic would go here
  }

  /**
   * Send shipping notification
   */
  async sendShippingNotification(
    email: string, 
    orderId: string, 
    trackingNumber: string
  ): Promise<void> {
    this.logger.info('Sending shipping notification', { 
      email, 
      orderId, 
      trackingNumber 
    });
    // Email sending logic would go here
  }
}

// Service decorator
export function Service(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('service', true, target);
  };
}
