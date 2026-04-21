/**
 * Example Model - Product
 * Demonstrates ArchMate's model/entity detection
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  stock: number;
  images: string[];
  attributes: ProductAttribute[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  stock: number;
  images?: string[];
  attributes?: ProductAttribute[];
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  stock?: number;
  images?: string[];
  attributes?: ProductAttribute[];
  isActive?: boolean;
}

/**
 * ProductEntity - Database entity for products
 */
@Entity
export class ProductEntity {
  @PrimaryKey()
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  sku: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'json' })
  images: string[];

  @Column({ type: 'json' })
  attributes: ProductAttribute[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => CategoryEntity)
  categoryEntity: CategoryEntity;

  @OneToMany(() => OrderItemEntity, (item) => item.product)
  orderItems: OrderItemEntity[];
}

/**
 * CategoryEntity - Product category
 */
@Entity
export class CategoryEntity {
  @PrimaryKey()
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  parentId: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProductEntity, (product) => product.categoryEntity)
  products: ProductEntity[];

  @ManyToOne(() => CategoryEntity, (category) => category.children)
  @JoinColumn({ name: 'parentId' })
  parent: CategoryEntity;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children: CategoryEntity[];
}

/**
 * OrderItemEntity - Order line item
 */
@Entity
export class OrderItemEntity {
  @PrimaryKey()
  id: string;

  @Column({ type: 'varchar' })
  orderId: string;

  @Column({ type: 'varchar' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @ManyToOne(() => ProductEntity, (product) => product.orderItems)
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @ManyToOne(() => OrderEntity, (order) => order.items)
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;
}

/**
 * OrderEntity - Order header
 */
@Entity
export class OrderEntity {
  @PrimaryKey()
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'text', nullable: true })
  shippingAddress: string;

  @Column({ type: 'text', nullable: true })
  billingAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items: OrderItemEntity[];

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}

/**
 * UserEntity - User account
 */
@Entity
export class UserEntity {
  @PrimaryKey()
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderEntity, (order) => order.user)
  orders: OrderEntity[];
}

// TypeORM Decorators
export function Entity(): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('entity', true, target);
  };
}

export function PrimaryKey(): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('primaryKey', true, target, propertyKey as string);
  };
}

export function Column(options?: {
  type?: string;
  length?: number;
  precision?: number;
  scale?: number;
  default?: unknown;
  nullable?: boolean;
  unique?: boolean;
}): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('column', options || {}, target, propertyKey as string);
  };
}

export function CreateDateColumn(): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('createDate', true, target, propertyKey as string);
  };
}

export function UpdateDateColumn(): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('updateDate', true, target, propertyKey as string);
  };
}

export function OneToMany(
  typeFunction: () => unknown,
  inverseSide: string
): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('oneToMany', { typeFunction, inverseSide }, target, propertyKey as string);
  };
}

export function ManyToOne(typeFunction: () => unknown): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('manyToOne', true, target, propertyKey as string);
  };
}

export function JoinColumn(options?: Record<string, unknown>): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('joinColumn', options || {}, target, propertyKey as string);
  };
}
