# Akt-Tcc

一个简单的 TCC 分布式事务

使用了两阶段提交实现

## txmanager

- 包含了事务协调器 TXManager 有关的核心流程
- 开启事务以及 try-confirm/cancel 的两阶段提交流程串联
- 异步轮询任务，用于推进事务从中间态走向终态
- 定义了事务日志存储模块 TXStore 的 interface
- 定义了 TCC 组件 TCCComponent 的 interface

## example

• 实现 TCCComponent 类，包括其 Try、Confirm、Cancel 方法的执行逻辑
• 实现具体的 TXStore 模块
