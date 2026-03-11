import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, List, Button, Tag, Typography, Space, Tooltip, Segmented, Empty, Popconfirm } from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  BellOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';

const { Text, Title } = Typography;
const UPCOMING_NOTIFICATION_TITLE = 'Nhắc bảo trì định kỳ';

const TYPE_CONFIG = {
  maintenance_schedule_upcoming: { color: 'blue', label: 'Nhắc lịch', icon: <ToolOutlined /> },
};

function getDisplayTitle(notification) {
  if (notification.type === 'maintenance_schedule_upcoming') return UPCOMING_NOTIFICATION_TITLE;
  return notification.title;
}

export default function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const readParam = filter === 'unread' ? '&read=false' : filter === 'read' ? '&read=true' : '';
    const { data, error } = await api.get(`/notifications?page=${page}&limit=${limit}${readParam}`);
    setLoading(false);
    if (error) return;
    setNotifications(data?.data ?? []);
    setTotal(data?.total ?? 0);
  }, [page, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleMarkRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/mark-all-read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDelete = async (id) => {
    await api.delete(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotal((prev) => prev - 1);
  };

  const handleClick = (n) => {
    if (!n.read) {
      api.patch(`/notifications/${n.id}/read`);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.type === 'maintenance_schedule_upcoming' && n.maintenance_schedule_id) {
      navigate(`/maintenance-orders/schedule/${n.maintenance_schedule_id}/detail`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          Tất cả thông báo
        </Title>
        <Space>
          {unreadCount > 0 && (
            <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'Tất cả', value: 'all' },
            { label: 'Chưa đọc', value: 'unread' },
            { label: 'Đã đọc', value: 'read' },
          ]}
        />
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <List
          loading={loading}
          dataSource={notifications}
          locale={{ emptyText: <Empty description="Không có thông báo" style={{ padding: 40 }} /> }}
          pagination={{
            current: page,
            total,
            pageSize: limit,
            onChange: setPage,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          renderItem={(n) => {
            const typeConf = TYPE_CONFIG[n.type] || { color: 'default', label: n.type, icon: <BellOutlined /> };
            return (
              <List.Item
                style={{
                  padding: '14px 20px',
                  cursor: 'pointer',
                  background: n.read ? 'transparent' : 'rgba(22, 119, 255, 0.04)',
                  transition: 'background 0.2s',
                }}
                onClick={() => handleClick(n)}
                actions={[
                  !n.read && (
                    <Tooltip title="Đánh dấu đã đọc" key="read">
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(n.id);
                        }}
                      />
                    </Tooltip>
                  ),
                  <Popconfirm
                    key="delete"
                    title="Xóa thông báo này?"
                    onConfirm={(e) => {
                      e?.stopPropagation?.();
                      handleDelete(n.id);
                    }}
                    onCancel={(e) => e?.stopPropagation?.()}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Tooltip title="Xóa">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Tooltip>
                  </Popconfirm>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ position: 'relative', marginTop: 4 }}>
                      {!n.read && (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#1677ff',
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            zIndex: 1,
                          }}
                        />
                      )}
                      <Tag color={typeConf.color} icon={typeConf.icon} style={{ margin: 0 }}>
                        {typeConf.label}
                      </Tag>
                    </div>
                  }
                  title={<span style={{ fontWeight: n.read ? 400 : 600 }}>{getDisplayTitle(n)}</span>}
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {n.message}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {n.createdAt && new Date(n.createdAt).toLocaleString('vi-VN')}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
}
