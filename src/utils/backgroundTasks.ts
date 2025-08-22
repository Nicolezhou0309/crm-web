// 后台任务管理器
class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, () => Promise<void>> = new Map();
  private isProcessing = false;

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  // 添加后台任务
  addTask(taskId: string, task: () => Promise<void>): void {
    this.tasks.set(taskId, task);
    
    // 如果当前没有在处理任务，开始处理
    if (!this.isProcessing) {
      this.processTasks();
    }
  }

  // 处理所有后台任务
  private async processTasks(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    for (const [taskId, task] of this.tasks) {
      try {
        await task();
      } catch (error) {
        console.error(`后台任务失败: ${taskId}`, error);
      } finally {
        this.tasks.delete(taskId);
      }
    }
    
    this.isProcessing = false;
  }

  // 获取待处理任务数量
  getPendingTaskCount(): number {
    return this.tasks.size;
  }
}

// 导出单例实例
export const backgroundTaskManager = BackgroundTaskManager.getInstance();

// 添加边缘函数调用任务
export const addEdgeFunctionTask = (exchangeRecordId: number) => {
  const taskId = `edge-function-${exchangeRecordId}-${Date.now()}`;
  
  const task = async () => {
    const { supabase } = await import('../supaClient');
    
    try {
      const { error } = await supabase.functions.invoke('issue-direct-card', {
        body: { exchange_record_id: exchangeRecordId }
      });
      
      if (error) {
        console.error('后台边缘函数调用失败:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('后台边缘函数调用异常:', error);
      throw error;
    }
  };
  
  backgroundTaskManager.addTask(taskId, task);
}; 