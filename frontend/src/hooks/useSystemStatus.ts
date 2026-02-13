import { useState, useEffect } from "react";
import { systemService } from "@/services";
import type { SystemStatus } from "@/types/api";

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await systemService.getStatus();
        if (res.data.code === 0) {
          setStatus(res.data.data);
        }
      } catch (err) {
        console.error("检查系统状态失败", err);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  return { status, loading };
}
