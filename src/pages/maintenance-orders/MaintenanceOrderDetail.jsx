import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Spin,
  Typography,
  Button,
  Space,
  Tag,
  message,
  Table,
  Form,
  Input,
  InputNumber,
  Select,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;
const { TextArea } = Input;

const STATUS_MAP = {
  planned: { label: 'Dự kiến', color: 'default' },
  in_progress: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Đã hoàn thành', color: 'success' },
  cancelled: { label: 'Đã hủy', color: 'default' },
};
const USER_STATUS_OPTIONS = ['planned', 'in_progress', 'completed'];

const formatCurrency = (val) =>
  val != null ? `${Number(val).toLocaleString('vi-VN')} đ` : '-';

export default function MaintenanceOrderDetail() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { id, scheduleId } = useParams();
  const { isAdmin } = useAuth();
  const fromContractId = location.state?.fromContractId;
  const fromMyJobs = location.state?.fromMyJobs;
  const canEdit = isAdmin || order?.can_edit;

  const formatDate = (val) => {
    if (!val) return '-';
    const d = dayjs(val);
    return d.isValid() ? d.format('DD-MM-YYYY') : '-';
  };

  const fetchOrder = async () => {
    setLoading(true);
    let data;
    let error;
    if (scheduleId) {
      const res = await api.get(`/maintenance-orders/by-schedule/${scheduleId}`);
      data = res.data;
      error = res.error;
    } else {
      const res = await api.get(`/maintenance-orders/${id}`);
      data = res.data;
      error = res.error;
    }
    if (!error && data) {
      setOrder(data);
      form.setFieldsValue({
        work_content: data.work_content || '',
        status: data.status || 'planned',
        assigned_user_ids: Array.isArray(data.assigned_user_ids) ? data.assigned_user_ids : [],
        items: Array.isArray(data.items) && data.items.length > 0
          ? data.items.map((it) => ({
              product_id: it.product_id,
              quantity: it.quantity ?? 1,
              unit_price: it.unit_price ?? 0,
            }))
          : [],
      });
    } else {
      message.error(error?.message || 'Không tìm thấy đơn bảo trì');
      navigate(fromMyJobs ? '/my-jobs' : '/maintenance-orders');
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await api.get('/products');
    setProducts(Array.isArray(data) ? data : []);
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    const { data } = await api.get('/users');
    setUsers(Array.isArray(data) ? data.filter((u) => u.role === 'user') : []);
  };

  useEffect(() => {
    loadProducts();
    loadUsers();
    if (id || scheduleId) fetchOrder();
  }, [id, scheduleId, isAdmin]);

  const onFinish = async (values) => {
    setSaving(true);
    const payload = {
      work_content: values.work_content || '',
      status: values.status || 'planned',
      items: Array.isArray(values.items)
        ? values.items
            .filter((it) => it && it.product_id)
            .map((it) => ({
              product_id: it.product_id,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) ?? 0,
            }))
        : [],
    };
    if (isAdmin) {
      payload.assigned_user_ids = Array.isArray(values.assigned_user_ids) ? values.assigned_user_ids : [];
    }
    const orderId = order?.id;
    if (!orderId) {
      message.error('Không thể cập nhật');
      setSaving(false);
      return;
    }
    const { error: err } = await api.put(`/maintenance-orders/${orderId}`, payload);
    if (err) {
      message.error('Lỗi cập nhật đơn bảo trì');
    } else {
      message.success('Đã cập nhật đơn bảo trì');
      setEditing(false);
      fetchOrder();
    }
    setSaving(false);
  };

  if (loading || !order) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const statusCfg = STATUS_MAP[order.status];
  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name}${p.unit ? ` (${p.unit})` : ''}`,
  }));

  const viewModeItems = (order.items || []).map((it, idx) => ({
    ...it,
    key: idx,
    product_name: it.product_name || '-',
    product_unit: it.product_unit,
  }));

  const materialColumns = [
    { title: 'Vật tư', dataIndex: 'product_name', key: 'product_name', render: (v, r) => `${v || '-'}${r.product_unit ? ` (${r.product_unit})` : ''}` },
    { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right', width: 100 },
    { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', align: 'right', render: (v) => formatCurrency(v), width: 140 },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              fromContractId
                ? navigate(`/contracts/${fromContractId}/detail`)
                : (scheduleId ? navigate('/maintenance-calendar') : navigate(fromMyJobs ? '/my-jobs' : '/maintenance-orders'))
            }
          >
            Quay lại
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Chi tiết đơn bảo trì
          </Title>
        </Space>
        <Space>
          {canEdit && !editing && (
            <Button type="primary" onClick={() => setEditing(true)}>
              Chỉnh sửa
            </Button>
          )}
          {editing && (
            <Button onClick={() => {
              setEditing(false);
              form.setFieldsValue({
                work_content: order.work_content,
                status: order.status,
                assigned_user_ids: order.assigned_user_ids || [],
                items: order.items || [],
              });
            }}>
              Hủy
            </Button>
          )}
        </Space>
      </div>

      <Card title="Thông tin khách hàng & hợp đồng" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Khách hàng" span={1}>
            {order.customer_id ? (
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => navigate(`/customers/${order.customer_id}/detail`)}
              >
                {order.customer_name || '-'}
              </Button>
            ) : (
              order.customer_name || '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Hợp đồng" span={1}>
            {order.contract_id ? (
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => navigate(`/contracts/${order.contract_id}/detail`)}
              >
                {order.contract_number || '-'}
              </Button>
            ) : (
              order.contract_number || '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Thang máy" span={1}>
            {order.elevator_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày bảo trì" span={1}>
            {formatDate(order.scheduled_date)}
          </Descriptions.Item>
          <Descriptions.Item label="Tiêu đề" span={2}>
            {order.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái" span={1}>
            {statusCfg ? <Tag color={statusCfg.color}>{statusCfg.label}</Tag> : order.status || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Người phụ trách" span={2}>
            {Array.isArray(order.assigned_users) && order.assigned_users.length > 0 ? (
              <Space size={[4, 4]} wrap>
                {order.assigned_users.map((u) => (
                  <Tag key={u.id}>{u.full_name || u.email || 'User'}</Tag>
                ))}
              </Space>
            ) : (
              <span style={{ color: '#999' }}>Chưa gán</span>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {editing ? (
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ work_content: order.work_content, status: order.status, items: order.items || [] }}>
          <Card title="Nội dung công tác bảo trì" style={{ marginBottom: 16 }}>
            <Form.Item name="work_content" label="Nội dung công tác">
              <TextArea rows={4} placeholder="Nhập nội dung công tác bảo trì" />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select
                options={Object.entries(STATUS_MAP)
                  .filter(([k]) => (isAdmin ? true : USER_STATUS_OPTIONS.includes(k) || k === order.status))
                  .map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </Form.Item>
            {isAdmin && (
              <Form.Item name="assigned_user_ids" label="Gán cho user">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Chọn 1 hoặc nhiều user"
                  optionFilterProp="label"
                  options={users.map((u) => ({
                    value: u.id,
                    label: `${u.full_name || '(Chưa có tên)'} - ${u.email}`,
                  }))}
                />
              </Form.Item>
            )}
          </Card>

          <Card
            title="Vật tư sử dụng (ghi giá thành, không tính tổng tiền)"
            style={{ marginBottom: 16 }}
          >
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <div
                      key={field.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2.5fr 1fr 1fr auto',
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <Form.Item
                        name={[field.name, 'product_id']}
                        label={index === 0 ? 'Vật tư' : ''}
                        rules={[{ required: true, message: 'Chọn vật tư' }]}
                      >
                        <Select
                          placeholder="Chọn vật tư"
                          showSearch
                          optionFilterProp="label"
                          options={productOptions}
                          onChange={(value) => {
                            const product = products.find((p) => p.id === value);
                            const currentItems = form.getFieldValue('items') || [];
                            const nextItems = [...currentItems];
                            const row = { ...(nextItems[field.name] || {}) };
                            row.product_id = value;
                            row.unit_price = product?.price ?? 0;
                            if (!row.quantity) row.quantity = 1;
                            nextItems[field.name] = row;
                            form.setFieldsValue({ items: nextItems });
                          }}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'quantity']}
                        label={index === 0 ? 'Số lượng' : ''}
                        rules={[{ required: true, message: 'Nhập số lượng' }]}
                      >
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'unit_price']}
                        label={index === 0 ? 'Đơn giá' : ''}
                        rules={[{ required: true, message: 'Nhập đơn giá' }]}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          formatter={(value) =>
                            value != null ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                          }
                          parser={(value) => value.replace(/,/g, '')}
                        />
                      </Form.Item>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      </div>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })} style={{ marginTop: 8 }}>
                    Thêm vật tư
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Lưu thay đổi
            </Button>
            <Button onClick={() => setEditing(false)}>Hủy</Button>
          </Space>
        </Form>
      ) : (
        <>
          <Card title="Nội dung công tác bảo trì" style={{ marginBottom: 16 }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{order.work_content || 'Chưa có nội dung.'}</div>
          </Card>

          <Card title="Vật tư sử dụng (ghi giá thành, không tính tổng tiền)">
            {viewModeItems.length > 0 ? (
              <Table
                columns={materialColumns}
                dataSource={viewModeItems}
                rowKey="key"
                pagination={false}
                size="small"
              />
            ) : (
              <div style={{ color: '#999' }}>Chưa có vật tư nào.</div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
