#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Terminal MCP 进程终止脚本
一键结束所有相关的Node.js进程

作者: 瑶瑶
日期: 2025-07-13
"""

import subprocess
import sys
import os
import time
from typing import List, Dict, Any

# 常量定义
PROJECT_PATH = "ai-terminal-mcp"
TARGET_PROCESSES = ["node.exe", "powershell.exe"]
ENCODING = 'gbk'
WAIT_TIME = 2

# 命令常量
TASKLIST_CMD = ['tasklist', '/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV']
TASKKILL_CMD_PREFIX = ['taskkill', '/F']
WMIC_CMD_PREFIX = ['wmic', 'process', 'where']

# 关键词常量
MCP_KEYWORDS = [PROJECT_PATH, "server.js", "gui-server.js", "mcp", "terminal"]

class MCPProcessKiller:
    """MCP进程终止器"""
    
    def __init__(self):
        self.project_path = PROJECT_PATH
        self.target_processes = TARGET_PROCESSES

    def _run_command(self, cmd: List[str], encoding: str = ENCODING) -> subprocess.CompletedProcess:
        """执行命令并返回结果"""
        return subprocess.run(cmd, capture_output=True, text=True, encoding=encoding)

    def _parse_tasklist_output(self, output: str) -> List[Dict[str, Any]]:
        """解析tasklist命令输出"""
        processes = []
        lines = output.strip().split('\n')

        # 跳过标题行
        for line in lines[1:]:
            if line.strip():
                parts = [part.strip('"') for part in line.split('","')]
                if len(parts) >= 2:
                    processes.append({
                        'name': parts[0],
                        'pid': parts[1],
                        'session': parts[2] if len(parts) > 2 else '',
                        'memory': parts[4] if len(parts) > 4 else ''
                    })
        return processes

    def _print_status(self, message: str, status_type: str = "info"):
        """打印状态消息"""
        icons = {
            "success": "✅",
            "error": "❌",
            "warning": "⚠️",
            "info": "ℹ️",
            "target": "🎯",
            "fire": "🔥",
            "search": "🔍"
        }
        icon = icons.get(status_type, "📋")
        print(f"{icon} {message}")

    def get_node_processes(self) -> List[Dict[str, Any]]:
        """获取所有Node.js进程信息"""
        try:
            result = self._run_command(TASKLIST_CMD)

            if result.returncode != 0:
                self._print_status(f"获取进程列表失败: {result.stderr}", "error")
                return []

            return self._parse_tasklist_output(result.stdout)

        except Exception as e:
            self._print_status(f"获取Node.js进程失败: {e}", "error")
            return []
    
    def get_process_command_line(self, pid: str) -> str:
        """获取进程的命令行参数"""
        try:
            cmd = WMIC_CMD_PREFIX + [f'ProcessId={pid}', 'get', 'CommandLine', '/format:value']
            result = self._run_command(cmd)

            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if line.startswith('CommandLine='):
                        return line.replace('CommandLine=', '').strip()

            return ""

        except Exception as e:
            self._print_status(f"获取进程 {pid} 命令行失败: {e}", "warning")
            return ""
    
    def is_mcp_related_process(self, pid: str) -> bool:
        """判断进程是否与MCP项目相关"""
        cmd_line = self.get_process_command_line(pid)
        cmd_line_lower = cmd_line.lower()
        return any(keyword.lower() in cmd_line_lower for keyword in MCP_KEYWORDS)
    
    def kill_process(self, pid: str) -> bool:
        """终止指定PID的进程"""
        try:
            cmd = TASKKILL_CMD_PREFIX + ['/PID', pid]
            result = self._run_command(cmd)

            if result.returncode == 0:
                self._print_status(f"成功终止进程 PID: {pid}", "success")
                return True
            else:
                self._print_status(f"终止进程 {pid} 失败: {result.stderr}", "error")
                return False

        except Exception as e:
            self._print_status(f"终止进程 {pid} 异常: {e}", "error")
            return False
    
    def kill_all_node_processes(self) -> int:
        """终止所有Node.js进程（暴力模式）"""
        try:
            cmd = TASKKILL_CMD_PREFIX + ['/IM', 'node.exe']
            result = self._run_command(cmd)

            if result.returncode == 0:
                # 统计终止的进程数量
                lines = result.stdout.strip().split('\n')
                count = len([line for line in lines if '成功' in line and 'node.exe' in line])
                self._print_status(f"暴力模式：成功终止 {count} 个Node.js进程", "fire")
                return count
            else:
                self._print_status(f"暴力终止失败: {result.stderr}", "error")
                return 0

        except Exception as e:
            self._print_status(f"暴力终止异常: {e}", "error")
            return 0
    
    def smart_kill(self) -> int:
        """智能终止模式：只终止MCP相关进程"""
        self._print_status("智能模式：扫描MCP相关进程...", "search")

        processes = self.get_node_processes()
        if not processes:
            self._print_status("没有找到Node.js进程", "info")
            return 0

        killed_count = 0
        mcp_processes = []

        print(f"📋 发现 {len(processes)} 个Node.js进程，正在分析...")

        for process in processes:
            pid = process['pid']
            if self.is_mcp_related_process(pid):
                mcp_processes.append(process)
                self._print_status(f"发现MCP相关进程: PID {pid}", "target")

        if not mcp_processes:
            self._print_status("没有找到MCP相关的Node.js进程", "info")
            return 0

        print(f"\n🚀 准备终止 {len(mcp_processes)} 个MCP相关进程...")

        for process in mcp_processes:
            if self.kill_process(process['pid']):
                killed_count += 1

        return killed_count
    
    def force_kill(self) -> int:
        """强制终止模式：终止所有Node.js进程"""
        self._print_status("强制模式：终止所有Node.js进程...", "fire")
        return self.kill_all_node_processes()
    
    def check_remaining_processes(self) -> int:
        """检查剩余的Node.js进程"""
        processes = self.get_node_processes()
        if processes:
            print(f"\n⚠️ 仍有 {len(processes)} 个Node.js进程在运行:")
            for process in processes:
                print(f"   PID: {process['pid']}, 内存: {process['memory']}")
        else:
            print("\n✅ 所有Node.js进程已清理完毕")
        
        return len(processes)

def main():
    """主函数"""
    print("=" * 60)
    print("🚀 AI Terminal MCP 进程终止工具")
    print("=" * 60)
    
    killer = MCPProcessKiller()
    
    # 显示菜单
    print("\n请选择终止模式:")
    print("1. 🎯 智能模式 (只终止MCP相关进程)")
    print("2. 🔥 强制模式 (终止所有Node.js进程)")
    print("3. 📋 查看进程 (不终止)")
    print("0. ❌ 退出")
    
    try:
        choice = input("\n请输入选择 (1/2/3/0): ").strip()
        
        if choice == "1":
            killed = killer.smart_kill()
            print(f"\n📊 智能模式完成，共终止 {killed} 个进程")
            
        elif choice == "2":
            killed = killer.force_kill()
            print(f"\n📊 强制模式完成，共终止 {killed} 个进程")
            
        elif choice == "3":
            processes = killer.get_node_processes()
            if processes:
                print(f"\n📋 当前Node.js进程列表 ({len(processes)}个):")
                for i, process in enumerate(processes, 1):
                    cmd_line = killer.get_process_command_line(process['pid'])
                    is_mcp = killer.is_mcp_related_process(process['pid'])
                    status = "🎯 MCP相关" if is_mcp else "🔹 其他"
                    print(f"{i:2d}. {status} PID: {process['pid']}, 内存: {process['memory']}")
                    if cmd_line:
                        print(f"     命令: {cmd_line[:80]}...")
            else:
                print("\n✅ 没有找到Node.js进程")
            return
            
        elif choice == "0":
            print("\n👋 退出程序")
            return
            
        else:
            print("\n❌ 无效选择")
            return
        
        # 等待一下再检查
        time.sleep(WAIT_TIME)
        killer.check_remaining_processes()
        
    except KeyboardInterrupt:
        print("\n\n⚠️ 用户中断操作")
    except Exception as e:
        print(f"\n❌ 程序异常: {e}")
    
    print("\n🎉 操作完成！")

if __name__ == "__main__":
    main()
