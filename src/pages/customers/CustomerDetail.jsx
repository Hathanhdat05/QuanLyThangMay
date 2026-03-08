import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, message, Table, Tag } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const STATUS_MAP = {
  draft: { label: 'Nháp', color: 'default' },
  active: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Hoàn thành', color: 'success' },
  cancelled: { label: 'Đã hủy', color: 'error' },
};

const CONTRACT_TYPE_MAP = {
  installation: { label: 'Lắp đặt', color: 'blue' },
  maintenance: { label: 'Bảo trì', color: 'gold' },
  warranty: { label: 'Bảo hành', color: 'purple' },
};

export default function CustomerDetail() {
  const [customer, setCustomer] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const fromMaintenanceCalendar = location.state?.fromMaintenanceCalendar;
  const fromErrorReportId = location.state?.fromErrorReportId;
  const returnToCalendarWithErrorReportId = location.state?.returnToCalendarWithErrorReportId;
  const returnToCalendarWithScheduleId = location.state?.returnToCalendarWithScheduleId;

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/customers/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy khách hàng');
        navigate(returnToCalendarWithScheduleId
          ? '/maintenance-calendar'
          : returnToCalendarWithErrorReportId
            ? '/maintenance-calendar'
            : fromErrorReportId
              ? `/error-reports/${fromErrorReportId}/detail`
              : fromMaintenanceCalendar
                ? '/maintenance-calendar'
                : '/customers',
        returnToCalendarWithScheduleId
          ? { state: { openScheduleId: returnToCalendarWithScheduleId } }
          : returnToCalendarWithErrorReportId
            ? { state: { openErrorReportId: returnToCalendarWithErrorReportId } }
            : undefined);
        return;
      }
      setCustomer(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    const run = async () => {
      setContractsLoading(true);
      const { data, error } = await api.get(`/contracts?customer_id=${encodeURIComponent(id)}`);
      if (!isMounted) return;
      if (error) {
        setContracts([]);
      } else {
        setContracts(Array.isArray(data) ? data : []);
      }
      setContractsLoading(false);
    };
    run();
    return () => { isMounted = false; };
  }, [id]);

  if (loading || !customer) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() =>
            navigate(returnToCalendarWithScheduleId
              ? '/maintenance-calendar'
              : returnToCalendarWithErrorReportId
                ? '/maintenance-calendar'
                : fromErrorReportId
                  ? `/error-reports/${fromErrorReportId}/detail`
                  : fromMaintenanceCalendar
                    ? '/maintenance-calendar'
                    : '/customers',
            returnToCalendarWithScheduleId
              ? { state: { openScheduleId: returnToCalendarWithScheduleId } }
              : returnToCalendarWithErrorReportId
                ? { state: { openErrorReportId: returnToCalendarWithErrorReportId } }
                : undefined)
          }
        >
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết khách hàng
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/customers/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Card style={{ maxWidth: 700 }}>
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="ID khách hàng">{customer.customerId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên khách hàng">{customer.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Loại khách hàng">
            {customer.customerType === 'business' ? 'Doanh nghiệp' : 'Cá nhân'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{customer.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Khu vực">{customer.region || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tỉnh / Thành phố">{customer.province || '-'}</Descriptions.Item>
          <Descriptions.Item label="Quận / Huyện">{customer.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ chi tiết">{customer.addressDetail || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ đầy đủ">{customer.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{customer.note || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Hợp đồng của khách hàng" style={{ maxWidth: 900, marginTop: 24 }}>
        <Table
          rowKey="id"
          loading={contractsLoading}
          dataSource={contracts}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} hợp đồng` }}
          columns={[
            {
              title: 'Số hợp đồng',
              dataIndex: 'contract_number',
              key: 'contract_number',
              render: (text, record) => (
                <Button
                  type="link"
                  style={{ padding: 0 }}
                  onClick={() => navigate(`/contracts/${record.id}/detail`, { state: { fromCustomerId: id } })}
                >
                  {text || '(Chưa có số)'}
                </Button>
              ),
            },
            {
              title: 'Loại hợp đồng',
              dataIndex: 'contract_type',
              key: 'contract_type',
              render: (v) => {
                const t = CONTRACT_TYPE_MAP[v];
                return t ? <Tag color={t.color}>{t.label}</Tag> : (v || '-');
              },
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              render: (v) => {
                const s = STATUS_MAP[v];
                return s ? <Tag color={s.color}>{s.label}</Tag> : (v || '-');
              },
            },
            {
              title: 'Ngày bắt đầu',
              dataIndex: 'start_date',
              key: 'start_date',
              render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('DD-MM-YYYY') : '-'),
            },
            {
              title: 'Ngày kết thúc',
              dataIndex: 'end_date',
              key: 'end_date',
              render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('DD-MM-YYYY') : '-'),
            },
            {
              title: '',
              key: 'action',
              width: 100,
              render: (_, record) => (
                <Button type="link" size="small" onClick={() => navigate(`/contracts/${record.id}/detail`, { state: { fromCustomerId: id } })}>
                  Xem chi tiết
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

