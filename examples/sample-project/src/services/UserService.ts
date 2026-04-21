/**
 * Example Service - UserService
 * Demonstrates ArchMate's service detection
 */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
}

/**
 * UserService handles user management operations
 */
@Service
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new user
   */
  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.info('Creating new user', { email: dto.email });

    // Check if user already exists
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new Error('User already exists');
    }

    // Create user
    const user: User = {
      id: this.generateId(),
      email: dto.email,
      name: dto.name,
      createdAt: new Date(),
    };

    const savedUser = await this.userRepository.save(user);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(savedUser.email);

    this.logger.info('User created successfully', { userId: savedUser.id });
    return savedUser;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Update user information
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = {
      ...user,
      ...dto,
    };

    return this.userRepository.save(updatedUser);
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.delete(id);
    this.logger.info('User deleted', { userId: id });
  }

  /**
   * List all users with pagination
   */
  async listUsers(page: number = 1, limit: number = 10): Promise<User[]> {
    return this.userRepository.findAll(page, limit);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Logger service for application logging
 */
export class Logger {
  info(message: string, context?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, context || '');
  }

  error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context || '');
  }
}

/**
 * UserRepository handles database operations for users
 */
@Repository
export class UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findAll(page: number, limit: number): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    const start = (page - 1) * limit;
    return allUsers.slice(start, start + limit);
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

/**
 * EmailService handles email notifications
 */
@Service
export class EmailService {
  async sendWelcomeEmail(email: string): Promise<void> {
    console.log(`Sending welcome email to ${email}`);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    console.log(`Sending password reset email to ${email}`);
  }

  async sendNotificationEmail(email: string, message: string): Promise<void> {
    console.log(`Sending notification to ${email}: ${message}`);
  }
}
