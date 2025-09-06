/**
 * RealtimeManager - 统一的Realtime连接管理器
 * 采用单例模式，负责管理所有连接和订阅
 * 支持页面连接和长期连接两种类型
 */

import { supabase } from '../supaClient';

export interface RealtimeSubscription {
  id: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  userId: string;
  createdAt: number;
  lastUsed?: number;
  source?: string;
  connectionType?: 'page' | 'long-term';
}

// 数据变化监听器接口
export interface DataChangeListener {
  id: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  callback: (payload: any) => void;
  source?: string;
}


export interface ConnectionInfo {
  id: string;
  channel: any;
  userId: string;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  subscriptionCount: number;
  source: string;
  connectionType: 'page' | 'long-term';
}

export interface RealtimeConfig {
  maxConnections: number;
  minConnections: number;
  pageIdleTimeout: number; // 页面连接空闲超时（毫秒）
  pageMaxAge: number; // 页面连接最大年龄（毫秒）
  longTermIdleTimeout: number; // 长期连接空闲超时（毫秒）
  longTermMaxAge: number; // 长期连接最大年龄（毫秒）
  enabled: boolean;
}

export interface RealtimeStats {
  totalConnections: number;
  activeSubscriptions: number;
  reconnects: number;
  errors: number;
  isConnected: boolean;
  config: RealtimeConfig;
  subscriptions: Array<{
    id: string;
    table: string;
    event: string;
    source: string;
    userId: string;
  }>;
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    queuedRequests: number;
    poolHits: number;
    poolMisses: number;
    connections: ConnectionInfo[];
  };
  dataChangeListeners: {
    totalListeners: number;
    processedEvents: number;
    listeners: Array<{
      id: string;
      table: string;
      event: string;
      source: string;
    }>;
  };
}

class RealtimeManager {
  private static instance: RealtimeManager;
  private connections: Map<string, ConnectionInfo> = new Map();
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private dataChangeListeners: Map<string, DataChangeListener> = new Map();
  private subscriptionCallbacks: Map<string, (payload: any) => void> = new Map(); // 存储订阅的回调函数
  private config: RealtimeConfig;
  private isEnabled: boolean = true;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private poolHits: number = 0;
  private poolMisses: number = 0;
  private reconnects: number = 0;
  private errors: number = 0;
  private eventTarget: EventTarget = new EventTarget();
  private processedEvents: Set<string> = new Set();

  private constructor() {
    this.config = {
      maxConnections: 5,
      minConnections: 1,
      pageIdleTimeout: 60 * 1000, // 1分钟
      pageMaxAge: 5 * 60 * 1000, // 5分钟
      longTermIdleTimeout: 30 * 60 * 1000, // 30分钟
      longTermMaxAge: 2 * 60 * 60 * 1000, // 2小时
      enabled: true
    };

    this.setupVisibilityChangeHandler();
    this.startCleanupTimer();
  }

  public static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * 设置页面可见性变化处理器
   */
  private setupVisibilityChangeHandler(): void {
    if (typeof document === 'undefined') return;

    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        console.log('🔍 [RealtimeManager] 页面不可见，暂停页面连接');
        this.pausePageConnections();
      } else {
        console.log('🔍 [RealtimeManager] 页面可见，恢复页面连接');
        this.resumePageConnections();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * 暂停页面连接
   */
  private pausePageConnections(): void {
    this.connections.forEach((connection, id) => {
      if (connection.connectionType === 'page' && connection.isActive) {
        console.log(`⏸️ [RealtimeManager] 暂停页面连接: ${id}`);
        connection.isActive = false;
        connection.lastUsed = Date.now();
      }
    });
  }

  /**
   * 恢复页面连接
   */
  private resumePageConnections(): void {
    this.connections.forEach((connection, id) => {
      if (connection.connectionType === 'page' && !connection.isActive) {
        console.log(`▶️ [RealtimeManager] 恢复页面连接: ${id}`);
        connection.isActive = true;
        connection.lastUsed = Date.now();
      }
    });
  }

  /**
   * 开始清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupConnections();
    }, 30000); // 每30秒清理一次
  }

  /**
   * 自动判断连接类型
   * 根据调用栈判断是否为页面组件调用
   */
  private determineConnectionType(source: string): 'page' | 'long-term' {
    // 如果 source 包含 'page' 或 'component'，则认为是页面连接
    if (source.includes('page') || source.includes('component') || source.includes('Page')) {
      return 'page';
    }
    
    // 如果 source 包含 'service' 或 'api'，则认为是长期连接
    if (source.includes('service') || source.includes('api') || source.includes('Service')) {
      return 'long-term';
    }
    
    // 默认根据调用栈判断
    try {
      const stack = new Error().stack || '';
      // 如果调用栈中包含 React 组件相关的关键词，认为是页面连接
      if (stack.includes('useRealtime') || stack.includes('useEffect') || stack.includes('component')) {
        return 'page';
      }
    } catch (error) {
      // 如果无法获取调用栈，默认为页面连接
    }
    
    // 默认返回页面连接
    return 'page';
  }

  /**
   * 获取或创建连接
   */
  private async getOrCreateConnection(
    userId: string, 
    source: string
  ): Promise<ConnectionInfo | null> {
    if (!this.isEnabled) {
      console.warn('⚠️ [RealtimeManager] Realtime功能已禁用');
      return null;
    }

    // 自动判断连接类型
    const connectionType = this.determineConnectionType(source);
    
    // 查找现有连接
    for (const [id, connection] of this.connections) {
      if (connection.userId === userId && 
          connection.source === source && 
          connection.connectionType === connectionType &&
          connection.isActive) {
        connection.lastUsed = Date.now();
        this.poolHits++;
        console.log(`🎯 [RealtimeManager] 连接池命中: ${id}`);
        return connection;
      }
    }

    // 检查连接数限制
    if (this.connections.size >= this.config.maxConnections) {
      console.warn('⚠️ [RealtimeManager] 已达到最大连接数限制');
      this.poolMisses++;
      return null;
    }

    // 创建新连接
    try {
      const connectionId = `conn_${userId}_${source}_${Date.now()}`;
      const channel = supabase.channel(connectionId);
      
      const connection: ConnectionInfo = {
        id: connectionId,
        channel,
        userId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
        subscriptionCount: 0,
        source,
        connectionType
      };

      this.connections.set(connectionId, connection);
      this.poolMisses++;
      
      // 发射状态变化事件
      this.emitStateChange();
      
      return connection;
    } catch (error) {
      console.error('❌ [RealtimeManager] 创建连接失败:', error);
      this.errors++;
      return null;
    }
  }

  /**
   * 订阅许可机制 - 检查是否可以创建新订阅
   */
  public async requestSubscriptionPermission(
    userId: string,
    subscription: Omit<RealtimeSubscription, 'id' | 'userId' | 'createdAt' | 'connectionType'>,
    dataChangeCallback?: (payload: any) => void
  ): Promise<{
    allowed: boolean;
    reason?: string;
    existingSubscriptionId?: string;
    connectionAvailable?: boolean;
  }> {
    if (!this.isEnabled) {
      return {
        allowed: false,
        reason: 'Realtime功能已禁用'
      };
    }

    // 检查连接池状态
    const connection = await this.getOrCreateConnection(
      userId, 
      subscription.source || 'unknown'
    );

    if (!connection) {
      return {
        allowed: false,
        reason: '无法获取连接，连接池已满或功能被禁用',
        connectionAvailable: false
      };
    }

    // 检查是否已存在相同的订阅
    const duplicateSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.userId === userId && 
             sub.table === subscription.table && 
             sub.event === subscription.event && 
             sub.filter === subscription.filter &&
             sub.source === subscription.source
             // 移除 connectionType 比较，因为相同用户和来源的订阅应该被认为是重复的
    );
    
    if (duplicateSubscriptions.length > 0) {
      // 选择最新的订阅作为最佳匹配
      const bestMatch = duplicateSubscriptions.reduce((latest, current) => 
        current.lastUsed && current.lastUsed > (latest.lastUsed || 0) ? current : latest
      );
      
      console.log(`🔄 [RealtimeManager] 发现重复订阅，使用现有订阅: ${bestMatch.id}`);
      
      // 如果提供了新的回调函数，更新现有订阅的回调函数
      if (dataChangeCallback) {
        this.subscriptionCallbacks.set(bestMatch.id, dataChangeCallback);
        console.log(`🔄 [RealtimeManager] 更新现有订阅的回调函数: ${bestMatch.id}`);
      }
      
      return {
        allowed: false,
        reason: '已存在相同的订阅',
        existingSubscriptionId: bestMatch.id,
        connectionAvailable: true
      };
    }

    return {
      allowed: true,
      connectionAvailable: true
    };
  }

  /**
   * 订阅数据库变化
   */
  public async subscribe(
    userId: string, 
    subscription: Omit<RealtimeSubscription, 'id' | 'userId' | 'createdAt' | 'connectionType'>,
    dataChangeCallback?: (payload: any) => void
  ): Promise<string> {
    console.log(`🔧 [RealtimeManager] 创建订阅:`, {
      userId,
      table: subscription.table,
      event: subscription.event,
      source: subscription.source,
      hasCallback: !!dataChangeCallback
    });
    
    // 首先请求许可
    const permission = await this.requestSubscriptionPermission(userId, subscription, dataChangeCallback);
    
    if (!permission.allowed) {
      if (permission.existingSubscriptionId) {
        // 如果存在重复订阅，返回现有订阅ID
        console.log(`🔄 [RealtimeManager] 使用现有订阅: ${permission.existingSubscriptionId}`);
        const existingSub = this.subscriptions.get(permission.existingSubscriptionId);
        if (existingSub) {
          existingSub.lastUsed = Date.now();
          // 如果提供了新的回调函数，更新现有订阅的回调函数
          if (dataChangeCallback) {
            console.log(`🔄 [RealtimeManager] 更新现有订阅的回调函数: ${permission.existingSubscriptionId}`);
            this.subscriptionCallbacks.set(permission.existingSubscriptionId, dataChangeCallback);
          }
        }
        return permission.existingSubscriptionId;
      } else {
        // 如果被拒绝，抛出错误
        throw new Error(permission.reason || '订阅被拒绝');
      }
    }

    const connection = await this.getOrCreateConnection(
      userId, 
      subscription.source || 'unknown'
    );

    if (!connection) {
      throw new Error('无法获取连接');
    }

    // 在创建订阅前再次检查是否已存在重复订阅（防止竞态条件）
    const duplicateSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.userId === userId && 
             sub.table === subscription.table && 
             sub.event === subscription.event && 
             sub.filter === subscription.filter &&
             sub.source === subscription.source
    );
    
    if (duplicateSubscriptions.length > 0) {
      // 选择最新的订阅作为最佳匹配
      const bestMatch = duplicateSubscriptions.reduce((latest, current) => 
        current.lastUsed && current.lastUsed > (latest.lastUsed || 0) ? current : latest
      );
      
      console.log(`🔄 [RealtimeManager] 创建订阅前发现重复订阅，使用现有订阅: ${bestMatch.id}`);
      
      // 如果提供了新的回调函数，更新现有订阅的回调函数
      if (dataChangeCallback) {
        this.subscriptionCallbacks.set(bestMatch.id, dataChangeCallback);
        console.log(`🔄 [RealtimeManager] 更新现有订阅的回调函数: ${bestMatch.id}`);
      }
      
      // 更新最后使用时间
      bestMatch.lastUsed = Date.now();
      
      return bestMatch.id;
    }

    const subscriptionId = `sub_${subscription.table}_${subscription.event}_${Date.now()}`;
    
    // 先存储回调函数，确保在监听器创建时就能使用
    if (dataChangeCallback) {
      this.subscriptionCallbacks.set(subscriptionId, dataChangeCallback);
      console.log(`🔗 [RealtimeManager] 预存储回调函数: ${subscriptionId}`);
    }
    
    try {
      // 在连接上添加监听器
      connection.channel.on('postgres_changes', {
        event: subscription.event,
        schema: 'public',
        table: subscription.table,
        filter: subscription.filter
      }, (payload: any) => {
        try {
          console.log(`📡 [RealtimeManager] 收到数据变化: table=${subscription.table}, event=${subscription.event}`);
          
          // 获取存储的回调函数
          const storedCallback = this.subscriptionCallbacks.get(subscriptionId);
          console.log(`📡 [RealtimeManager] 回调状态:`, {
            hasDirectCallback: !!dataChangeCallback,
            hasStoredCallback: !!storedCallback,
            subscriptionId: subscriptionId,
            totalStoredCallbacks: this.subscriptionCallbacks.size
          });
          
          // 优先使用存储的回调函数，如果没有则使用直接传递的回调函数
          const callbackToUse = storedCallback || dataChangeCallback;
          
          if (callbackToUse) {
            console.log(`📡 [RealtimeManager] 执行回调函数`);
            callbackToUse(payload);
          } else {
            console.warn(`⚠️ [RealtimeManager] 没有回调函数，跳过直接回调`);
            console.warn(`⚠️ [RealtimeManager] 调试信息:`, {
              subscriptionId,
              allStoredCallbacks: Array.from(this.subscriptionCallbacks.keys()),
              dataChangeCallback: !!dataChangeCallback
            });
          }
          
          // 同时通知其他数据变化监听器（用于兼容性）
          this.notifyDataChangeListeners(subscription.table, subscription.event, payload);
        } catch (error) {
          console.error('❌ [RealtimeManager] 回调执行失败:', error);
          this.errors++;
        }
      });

      // 订阅连接
      connection.channel.subscribe((status: string) => {
        console.log(`📡 [RealtimeManager] 订阅状态变化: ${subscriptionId}, 状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log(`✅ [RealtimeManager] 订阅成功: ${subscriptionId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ [RealtimeManager] 订阅失败: ${subscriptionId}, 状态: ${status}`);
          console.error(`❌ [RealtimeManager] 连接信息:`, {
            connectionId: connection.id,
            userId: connection.userId,
            source: connection.source,
            isActive: connection.isActive,
            subscriptionCount: connection.subscriptionCount
          });
          this.errors++;
          this.reconnects++;
          
          // 尝试重新连接
          this.scheduleReconnect(subscriptionId, subscription, userId, connection.connectionType);
        } else if (status === 'TIMED_OUT') {
          console.error(`❌ [RealtimeManager] 订阅超时: ${subscriptionId}, 状态: ${status}`);
          this.errors++;
          this.reconnects++;
          
          // 尝试重新连接
          this.scheduleReconnect(subscriptionId, subscription, userId, connection.connectionType);
        } else {
          console.log(`📡 [RealtimeManager] 订阅状态: ${subscriptionId}, 状态: ${status}`);
        }
      });

      const fullSubscription: RealtimeSubscription = {
        id: subscriptionId,
        userId,
        createdAt: Date.now(),
        connectionType: connection.connectionType,
        ...subscription
      };

      this.subscriptions.set(subscriptionId, fullSubscription);
      
      connection.subscriptionCount++;
      connection.lastUsed = Date.now();

      console.log(`🔗 [RealtimeManager] 新增订阅: ${subscriptionId}`);
      
      // 发射状态变化事件
      this.emitStateChange();
      this.emitSubscriptionChange();
      
      return subscriptionId;
    } catch (error) {
      console.error('❌ [RealtimeManager] 创建订阅失败:', error);
      this.errors++;
      throw error;
    }
  }

  /**
   * 取消订阅
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`⚠️ [RealtimeManager] 订阅不存在: ${subscriptionId}`);
      return;
    }

    // 查找对应的连接并实际取消订阅
    for (const [connectionId, connection] of this.connections) {
      if (connection.userId === subscription.userId && 
          connection.source === subscription.source &&
          connection.connectionType === subscription.connectionType) {
        connection.subscriptionCount--;
        connection.lastUsed = Date.now();
        
        // 如果连接没有其他订阅，则清理整个连接
        if (connection.subscriptionCount <= 0) {
          try {
            supabase.removeChannel(connection.channel);
            this.connections.delete(connectionId);
            console.log(`🗑️ [RealtimeManager] 已清理连接和订阅: ${connectionId} - ${subscriptionId}`);
          } catch (error) {
            console.warn(`⚠️ [RealtimeManager] 清理连接失败: ${connectionId}`, error);
          }
        } else {
          console.log(`🗑️ [RealtimeManager] 已取消订阅: ${subscriptionId} (连接仍有其他订阅)`);
        }
        break;
      }
    }

    this.subscriptions.delete(subscriptionId);
    
    // 清理回调函数
    this.subscriptionCallbacks.delete(subscriptionId);
    
    // 发射状态变化事件
    this.emitStateChange();
    this.emitSubscriptionChange();
  }

  /**
   * 取消用户的所有订阅
   */
  public unsubscribeAll(userId: string): void {
    const userSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => sub.userId === userId);

    userSubscriptions.forEach(([id, _]) => {
      this.unsubscribe(id);
    });

  }

  /**
   * 清理过期连接
   */
  private cleanupConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.connections.forEach((connection, id) => {
      const age = now - connection.createdAt;
      const idleTime = now - connection.lastUsed;
      
      let shouldRemove = false;
      
      if (connection.connectionType === 'page') {
        // 页面连接：检查空闲时间或最大年龄
        shouldRemove = idleTime > this.config.pageIdleTimeout || age > this.config.pageMaxAge;
      } else {
        // 长期连接：检查空闲时间或最大年龄
        shouldRemove = idleTime > this.config.longTermIdleTimeout || age > this.config.longTermMaxAge;
      }

      // 如果连接没有活跃订阅，也可以清理
      if (connection.subscriptionCount === 0 && idleTime > 60000) { // 1分钟无订阅
        shouldRemove = true;
      }

      if (shouldRemove) {
        toRemove.push(id);
      }
    });

    // 移除过期连接
    toRemove.forEach(id => {
      const connection = this.connections.get(id);
      if (connection) {
        try {
          supabase.removeChannel(connection.channel);
        } catch (error) {
          console.warn('⚠️ [RealtimeManager] 移除连接失败:', error);
        }
        this.connections.delete(id);
      }
    });

    // 确保最小连接数
    if (this.connections.size < this.config.minConnections) {
    }
  }

  /**
   * 查找重复订阅
   */
  public findDuplicateSubscriptions(): Array<{
    table: string;
    event: string;
    filter?: string;
    duplicates: RealtimeSubscription[];
  }> {
    const subscriptionGroups = new Map<string, RealtimeSubscription[]>();
    
    // 按 table + event + filter 分组
    this.subscriptions.forEach(sub => {
      const key = `${sub.table}_${sub.event}_${sub.filter || 'no-filter'}`;
      if (!subscriptionGroups.has(key)) {
        subscriptionGroups.set(key, []);
      }
      subscriptionGroups.get(key)!.push(sub);
    });
    
    // 找出有重复的组
    const duplicates: Array<{
      table: string;
      event: string;
      filter?: string;
      duplicates: RealtimeSubscription[];
    }> = [];
    
    subscriptionGroups.forEach((subs, key) => {
      if (subs.length > 1) {
        const [table, event, filter] = key.split('_');
        duplicates.push({
          table,
          event,
          filter: filter === 'no-filter' ? undefined : filter,
          duplicates: subs
        });
      }
    });
    
    return duplicates;
  }

  /**
   * 获取统计信息
   */
  public getStats(): RealtimeStats {
    const now = Date.now();
    const connections = Array.from(this.connections.values());
    
    const activeConnections = connections.filter(c => c.isActive).length;
    const idleConnections = connections.filter(c => !c.isActive).length;

    return {
      totalConnections: this.connections.size,
      activeSubscriptions: this.subscriptions.size,
      reconnects: this.reconnects,
      errors: this.errors,
      isConnected: this.connections.size > 0,
      config: this.config,
      subscriptions: Array.from(this.subscriptions.values()).map(sub => ({
        id: sub.id,
        table: sub.table,
        event: sub.event,
        source: sub.source || 'unknown',
        userId: sub.userId
      })),
      connectionPool: {
        totalConnections: this.connections.size,
        activeConnections,
        idleConnections,
        queuedRequests: 0, // 当前没有队列实现
        poolHits: this.poolHits,
        poolMisses: this.poolMisses,
        connections: connections.map(conn => ({
          ...conn,
          age: now - conn.createdAt,
          idleTime: now - conn.lastUsed
        }))
      },
      dataChangeListeners: {
        totalListeners: this.dataChangeListeners.size,
        processedEvents: this.processedEvents.size,
        listeners: Array.from(this.dataChangeListeners.values()).map(listener => ({
          id: listener.id,
          table: listener.table,
          event: listener.event,
          source: listener.source || 'unknown'
        }))
      }
    };
  }

  /**
   * 启用或禁用功能
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      this.cleanupAll();
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(
    subscriptionId: string, 
    subscription: Omit<RealtimeSubscription, 'id' | 'userId' | 'createdAt' | 'connectionType'>, 
    userId: string, 
    connectionType: 'page' | 'long-term'
  ): void {
    console.log(`🔄 [RealtimeManager] 安排重连: ${subscriptionId}`);
    
    // 保存回调函数，用于重连后恢复
    const savedCallback = this.subscriptionCallbacks.get(subscriptionId);
    console.log(`🔄 [RealtimeManager] 保存回调函数用于重连: ${subscriptionId}`, !!savedCallback);
    
    // 延迟重连，避免频繁重试
    setTimeout(async () => {
      try {
        // 移除失败的订阅（但保留回调函数）
        this.subscriptions.delete(subscriptionId);
        
        // 清理对应的连接（如果存在）
        for (const [connectionId, connection] of this.connections) {
          if (connection.userId === userId && 
              connection.source === subscription.source &&
              connection.connectionType === connectionType) {
            try {
              supabase.removeChannel(connection.channel);
              this.connections.delete(connectionId);
              console.log(`🗑️ [RealtimeManager] 清理失败连接: ${connectionId}`);
            } catch (error) {
              console.warn(`⚠️ [RealtimeManager] 清理连接失败: ${connectionId}`, error);
            }
            break;
          }
        }
        
        // 重新创建订阅，并恢复回调函数
        const newSubscriptionId = await this.subscribe(userId, subscription, savedCallback || undefined);
        if (newSubscriptionId) {
          console.log(`✅ [RealtimeManager] 重连成功: ${newSubscriptionId}`);
          // 清理旧的回调函数（如果存在）
          if (savedCallback) {
            this.subscriptionCallbacks.delete(subscriptionId);
            console.log(`🗑️ [RealtimeManager] 清理旧回调函数: ${subscriptionId}`);
          }
        } else {
          console.error(`❌ [RealtimeManager] 重连失败: ${subscriptionId}`);
        }
      } catch (error) {
        console.error(`❌ [RealtimeManager] 重连过程中出错:`, error);
      }
    }, 5000); // 5秒后重连
  }

  /**
   * 清理所有连接和订阅
   */
  public cleanupAll(): void {
    console.log('🗑️ [RealtimeManager] 开始清理所有连接和订阅');
    
    // 清理所有连接（这会自动取消所有订阅）
    this.connections.forEach((connection, id) => {
      try {
        supabase.removeChannel(connection.channel);
        console.log(`🗑️ [RealtimeManager] 已清理连接: ${id}`);
      } catch (error) {
        console.warn('⚠️ [RealtimeManager] 移除连接失败:', error);
      }
    });
    this.connections.clear();
    
    // 清理所有订阅记录
    this.subscriptions.clear();
    
    // 清理所有数据变化监听器
    this.cleanupAllDataChangeListeners();
    
    // 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // 清理事件监听器
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    
  }

  /**
   * 全局清理订阅的机制
   */
  
  /**
   * 按用户清理所有订阅
   */
  public cleanupUserSubscriptions(userId: string): void {
    console.log(`🗑️ [RealtimeManager] 清理用户 ${userId} 的所有订阅`);
    
    const userSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => sub.userId === userId);
    
    userSubscriptions.forEach(([id, sub]) => {
      this.unsubscribe(id);
    });
    
    console.log(`✅ [RealtimeManager] 已清理用户 ${userId} 的 ${userSubscriptions.length} 个订阅`);
  }

  /**
   * 按连接类型清理订阅
   */
  public cleanupByConnectionType(connectionType: 'page' | 'long-term'): void {
    console.log(`🗑️ [RealtimeManager] 清理 ${connectionType} 类型的所有订阅`);
    
    const typeSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => sub.connectionType === connectionType);
    
    typeSubscriptions.forEach(([id, sub]) => {
      this.unsubscribe(id);
    });
    
    console.log(`✅ [RealtimeManager] 已清理 ${connectionType} 类型的 ${typeSubscriptions.length} 个订阅`);
  }

  /**
   * 按来源清理订阅
   */
  public cleanupBySource(source: string): void {
    console.log(`🗑️ [RealtimeManager] 清理来源 ${source} 的所有订阅`);
    
    const sourceSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => sub.source === source);
    
    sourceSubscriptions.forEach(([id, sub]) => {
      this.unsubscribe(id);
    });
    
    console.log(`✅ [RealtimeManager] 已清理来源 ${source} 的 ${sourceSubscriptions.length} 个订阅`);
  }

  /**
   * 清理过期订阅（超过指定时间的订阅）
   */
  public cleanupExpiredSubscriptions(maxAge: number = 30 * 60 * 1000): void {
    console.log(`🗑️ [RealtimeManager] 清理超过 ${maxAge / 1000 / 60} 分钟的订阅`);
    
    const now = Date.now();
    const expiredSubscriptions = Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => {
        const age = now - sub.createdAt;
        return age > maxAge;
      });
    
    expiredSubscriptions.forEach(([id, sub]) => {
      this.unsubscribe(id);
    });
    
    console.log(`✅ [RealtimeManager] 已清理 ${expiredSubscriptions.length} 个过期订阅`);
  }

  /**
   * 强制清理所有订阅（不清理连接）
   */
  public forceCleanupSubscriptions(): void {
    console.log('🗑️ [RealtimeManager] 强制清理所有订阅');
    
    this.subscriptions.forEach((sub, id) => {
      this.subscriptions.delete(id);
    });
    
    // 重置连接订阅计数
    this.connections.forEach(connection => {
      connection.subscriptionCount = 0;
    });
    
    console.log('✅ [RealtimeManager] 已强制清理所有订阅');
  }

  /**
   * 清理所有数据变化监听器
   */
  public cleanupAllDataChangeListeners(): void {
    console.log('🗑️ [RealtimeManager] 清理所有数据变化监听器');
    this.dataChangeListeners.clear();
    this.processedEvents.clear();
    console.log('✅ [RealtimeManager] 已清理所有数据变化监听器');
  }

  /**
   * 按来源清理数据变化监听器
   */
  public cleanupDataChangeListenersBySource(source: string): void {
    console.log(`🗑️ [RealtimeManager] 清理来源 ${source} 的数据变化监听器`);
    
    const toDelete: string[] = [];
    this.dataChangeListeners.forEach((listener, id) => {
      if (listener.source === source) {
        toDelete.push(id);
      }
    });
    
    toDelete.forEach(id => {
      this.dataChangeListeners.delete(id);
    });
    
    console.log(`✅ [RealtimeManager] 已清理 ${toDelete.length} 个数据变化监听器`);
  }

  /**
   * 注册数据变化监听器
   */
  public registerDataChangeListener(listener: Omit<DataChangeListener, 'id'>): string {
    // 检查是否已存在相同的监听器
    const existingListener = this.findDuplicateListener(listener);
    if (existingListener) {
      console.log(`🔄 [RealtimeManager] 发现重复监听器，返回现有ID: ${existingListener.id}`);
      return existingListener.id;
    }
    
    const listenerId = `listener_${listener.table}_${listener.event}_${Date.now()}`;
    
    const fullListener: DataChangeListener = {
      id: listenerId,
      ...listener
    };
    
    this.dataChangeListeners.set(listenerId, fullListener);
    console.log(`📡 [RealtimeManager] 注册数据变化监听器: ${listenerId}`);
    console.log(`📡 [RealtimeManager] 当前监听器总数: ${this.dataChangeListeners.size}`);
    
    return listenerId;
  }

  /**
   * 查找重复的监听器
   */
  private findDuplicateListener(listener: Omit<DataChangeListener, 'id'>): DataChangeListener | null {
    for (const existingListener of this.dataChangeListeners.values()) {
      if (existingListener.table === listener.table && 
          existingListener.event === listener.event && 
          existingListener.source === listener.source &&
          existingListener.callback === listener.callback) {
        return existingListener;
      }
    }
    return null;
  }

  /**
   * 取消数据变化监听器
   */
  public unregisterDataChangeListener(listenerId: string): void {
    if (this.dataChangeListeners.delete(listenerId)) {
      console.log(`🗑️ [RealtimeManager] 取消数据变化监听器: ${listenerId}`);
      console.log(`🗑️ [RealtimeManager] 剩余监听器数量: ${this.dataChangeListeners.size}`);
    } else {
      console.warn(`⚠️ [RealtimeManager] 监听器不存在: ${listenerId}`);
    }
  }

  /**
   * 通知所有相关的数据变化监听器
   */
  private notifyDataChangeListeners(table: string, event: string, payload: any): void {
    // 创建事件唯一标识符，防止重复处理
    const eventKey = `${table}_${event}_${payload.commit_timestamp || Date.now()}_${JSON.stringify(payload.new || payload.old)}`;
    
    // 检查是否已经处理过这个事件
    if (this.processedEvents.has(eventKey)) {
      console.log(`⏭️ [RealtimeManager] 跳过重复事件: ${eventKey}`);
      return;
    }
    
    // 标记事件为已处理
    this.processedEvents.add(eventKey);
    
    // 清理旧的事件记录（保留最近100个）
    if (this.processedEvents.size > 100) {
      const eventsArray = Array.from(this.processedEvents);
      const recentEvents = eventsArray.slice(-50);
      this.processedEvents = new Set(recentEvents);
    }
    
    console.log(`📡 [RealtimeManager] 通知数据变化监听器: table=${table}, event=${event}, listeners=${this.dataChangeListeners.size}`);
    console.log(`📡 [RealtimeManager] 监听器列表:`, Array.from(this.dataChangeListeners.values()).map(l => ({
      id: l.id,
      table: l.table,
      event: l.event,
      source: l.source
    })));
    
    this.dataChangeListeners.forEach((listener) => {
      console.log(`📡 [RealtimeManager] 检查监听器: ${listener.id}, table=${listener.table}, event=${listener.event}`);
      if (listener.table === table && 
          (listener.event === event || listener.event === '*')) {
        console.log(`📡 [RealtimeManager] 匹配监听器: ${listener.id}, 执行回调`);
        try {
          listener.callback(payload);
        } catch (error) {
          console.error(`❌ [RealtimeManager] 数据变化监听器执行失败: ${listener.id}`, error);
        }
      } else {
        console.log(`📡 [RealtimeManager] 不匹配监听器: ${listener.id}, table=${listener.table} vs ${table}, event=${listener.event} vs ${event}`);
      }
    });
  }

  /**
   * 发射状态变化事件
   */
  private emitStateChange(): void {
    this.eventTarget.dispatchEvent(new CustomEvent('stateChange', {
      detail: this.getStats()
    }));
  }

  /**
   * 发射订阅变化事件
   */
  private emitSubscriptionChange(): void {
    this.eventTarget.dispatchEvent(new CustomEvent('subscriptionChange', {
      detail: this.getStats()
    }));
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(event: string, listener: EventListener): void {
    this.eventTarget.addEventListener(event, listener);
  }

  /**
   * 移除事件监听器
   */
  public removeEventListener(event: string, listener: EventListener): void {
    this.eventTarget.removeEventListener(event, listener);
  }

}

// 导出单例实例
export const realtimeManager = RealtimeManager.getInstance();
