import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Loader2 } from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToUserNotifications,
  unsubscribeFromUserNotifications,
} from "../../services/notificationService.js";
import NotificationDropdown from "./NotificationDropdown.jsx";
import { getNotificationTitle } from "./NotificationItem.jsx";

function mergeNotification(currentNotifications, notification) {
  if (!notification?.id) return currentNotifications;
  const filtered = currentNotifications.filter((item) => item.id !== notification.id);
  return [notification, ...filtered]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);
}

export default function NotificationBell({ user, forceCloseKey, onOpen }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toastNotification, setToastNotification] = useState(null);

  const userId = user?.loginType === "phone_mock" ? user.id : "";
  const shownNotifications = useMemo(
    () => (filter === "unread" ? notifications.filter((item) => !item.is_read) : notifications),
    [filter, notifications],
  );

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMessage("");

    try {
      const [nextNotifications, nextUnreadCount] = await Promise.all([
        fetchNotifications({ userId, limit: 30, offset: 0 }),
        fetchUnreadNotificationCount(userId),
      ]);
      setNotifications(nextNotifications);
      setUnreadCount(Math.max(0, nextUnreadCount));
    } catch (error) {
      setErrorMessage(error?.message || "消息加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setOpen(false);
  }, [forceCloseKey]);

  useEffect(() => {
    if (!userId) {
      setOpen(false);
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    loadNotifications();

    let channel = null;
    try {
      channel = subscribeToUserNotifications({
        userId,
        onInsert: (notification) => {
          setNotifications((current) => mergeNotification(current, notification));
          if (!notification?.is_read) {
            setUnreadCount((current) => Math.max(0, current + 1));
          }
          setToastNotification(notification);
        },
        onUpdate: (notification) => {
          setNotifications((current) =>
            current.map((item) => (item.id === notification.id ? { ...item, ...notification } : item)),
          );
          fetchUnreadNotificationCount(userId)
            .then((count) => setUnreadCount(Math.max(0, count)))
            .catch(() => {});
        },
      });
    } catch (error) {
      setErrorMessage(error?.message || "消息实时订阅暂不可用。");
    }

    return () => {
      unsubscribeFromUserNotifications(channel);
    };
  }, [loadNotifications, userId]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!toastNotification) return undefined;
    const timer = window.setTimeout(() => setToastNotification(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toastNotification]);

  if (!userId) {
    return null;
  }

  const handleToggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        onOpen?.();
        loadNotifications();
      }
      return next;
    });
  };

  const handleSelectNotification = async (notification) => {
    const wasUnread = !notification.is_read;
    setOpen(false);
    setToastNotification(null);

    if (wasUnread) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    }

    try {
      if (wasUnread) {
        await markNotificationAsRead({ notificationId: notification.id, userId });
      }
    } catch (error) {
      if (wasUnread) {
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, is_read: false } : item)),
        );
        setUnreadCount((current) => Math.max(0, current + 1));
      }
      setErrorMessage(error?.message || "消息标记已读失败，请稍后重试。");
      return;
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount) return;
    setMarkingAll(true);
    setErrorMessage("");
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      })),
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead(userId);
    } catch (error) {
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
      setErrorMessage(error?.message || "全部已读失败，请稍后重试。");
    } finally {
      setMarkingAll(false);
    }
  };

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
        onClick={handleToggleOpen}
        aria-label={unreadCount > 0 ? `消息通知，${badgeText} 条未读` : "消息通知"}
        aria-expanded={open}
      >
        {loading && !notifications.length ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Bell size={19} aria-hidden="true" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-[18px] text-white">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={shownNotifications}
          filter={filter}
          unreadCount={unreadCount}
          loading={loading}
          markingAll={markingAll}
          errorMessage={errorMessage}
          onFilterChange={setFilter}
          onMarkAllRead={handleMarkAllRead}
          onSelect={handleSelectNotification}
          onRetry={loadNotifications}
        />
      )}

      {toastNotification && !open && (
        <button
          type="button"
          className="fixed right-4 top-20 z-[80] max-w-[320px] rounded-xl border border-blue-100 bg-white px-4 py-3 text-left shadow-2xl transition hover:border-brand-200"
          onClick={() => handleSelectNotification(toastNotification)}
        >
          <p className="text-sm font-bold text-slate-950">{getNotificationTitle(toastNotification)}</p>
          {toastNotification.target_preview && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{toastNotification.target_preview}</p>
          )}
        </button>
      )}
    </div>
  );
}
