import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/vi';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Typography, Card, Tag, Modal, Descriptions, Spin, message, Select, Space, Button } from 'antd';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

moment.locale('vi');
const localizer = momentLocalizer(moment);

const { Title } = Typography;

const PRIORITY_COLORS = {
  low: '#52c41a',
  medium: '#1677ff',
  high: '#fa8c16',
  critical: '#ff4d4f',
};

const STATUS_MAP = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  closed: 'Đã đóng',
};

const TYPE_MAP = {
  maintenance: 'Bảo trì',
  warranty: 'Bảo hành',
};

const PRIORITY_MAP = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
};

function formatDateDMY(value) {
  if (!value) return '-';
  const m = moment(value);
  if (!m.isValid()) return '-';
  return m.format('DD-MM-YYYY');
}

function parseCalendarDate(value) {
  if (!value) return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split('-').map((v) => Number(v));
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function copyText(text) {
  if (!text) return false;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

export default function MaintenanceCalendar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState(''); // '' = tất cả, 'schedule' = bảo trì định kỳ, 'report' = báo lỗi
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState('month');
  const [companyFeedUrl, setCompanyFeedUrl] = useState('');
  const [companyFeedLoading, setCompanyFeedLoading] = useState(false);
  const [companyFeedCopied, setCompanyFeedCopied] = useState(false);
  const [resyncLoading, setResyncLoading] = useState(false);
  const [resyncResult, setResyncResult] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [reportsRes, schedulesRes] = await Promise.all([
        api.get('/error-reports'),
        api.get('/maintenance-schedules'),
      ]);
      const list = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      const withScheduled = list.filter((r) => r.scheduled_date);
      const reportEvents = withScheduled.map((report) => ({
        id: `report-${report.id}`,
        title: report.title,
        start: parseCalendarDate(report.scheduled_date),
        end: parseCalendarDate(report.scheduled_date),
        allDay: true,
        resource: { ...report, source: 'report' },
      }));
      const schedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];
      const scheduleEvents = schedules.map((s) => ({
        id: `schedule-${s.id}`,
        title: s.title || `Bảo trì - ${s.elevator_name || 'Thang máy'}`,
        start: parseCalendarDate(s.scheduled_date),
        end: parseCalendarDate(s.scheduled_date),
        allDay: true,
        resource: { ...s, source: 'schedule' },
      }));
      let merged = [...reportEvents, ...scheduleEvents];
      if (typeFilter === 'schedule') merged = merged.filter((e) => e.resource?.source === 'schedule');
      else if (typeFilter === 'report') merged = merged.filter((e) => e.resource?.source === 'report');
      setEvents(merged);
    } catch {
      message.error('Lỗi tải dữ liệu lịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [typeFilter]);

  // Mở lại modal chi tiết báo lỗi hoặc lịch bảo trì khi quay về từ trang khách hàng/hợp đồng
  const openErrorReportId = location.state?.openErrorReportId;
  const openScheduleId = location.state?.openScheduleId;
  useEffect(() => {
    if (events.length === 0) return;
    if (openErrorReportId) {
      const reportEvent = events.find(
        (e) => e.resource?.source === 'report' && e.resource?.id === openErrorReportId
      );
      if (reportEvent) {
        setSelectedEvent(reportEvent.resource);
        setModalOpen(true);
        navigate('/maintenance-calendar', { replace: true, state: {} });
      }
      return;
    }
    if (openScheduleId) {
      const scheduleEvent = events.find(
        (e) => e.resource?.source === 'schedule' && e.resource?.id === openScheduleId
      );
      if (scheduleEvent) {
        setSelectedEvent(scheduleEvent.resource);
        setModalOpen(true);
        navigate('/maintenance-calendar', { replace: true, state: {} });
      }
    }
  }, [openErrorReportId, openScheduleId, events, navigate]);

  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event.resource);
    setModalOpen(true);
  }, []);

  const eventStyleGetter = useCallback((event) => {
    if (event.resource?.source === 'schedule') {
      return {
        style: {
          backgroundColor: '#13c2c2',
          borderRadius: 4,
          opacity: event.resource?.status === 'completed' ? 0.6 : 1,
          color: '#fff',
          border: 'none',
          fontSize: 12,
        },
      };
    }
    const priority = event.resource?.priority || 'medium';
    return {
      style: {
        backgroundColor: PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium,
        borderRadius: 4,
        opacity: event.resource?.status === 'closed' ? 0.5 : 1,
        color: '#fff',
        border: 'none',
        fontSize: 12,
      },
    };
  }, []);

  const fetchCompanyFeedUrl = useCallback(async () => {
    setCompanyFeedLoading(true);
    const { data, error } = await api.get('/google-calendar/shared-link');
    setCompanyFeedLoading(false);
    if (error) {
      setCompanyFeedUrl('');
      message.error(error.message || 'Không lấy được link Google Calendar');
      return;
    }
    setCompanyFeedUrl(data?.calendarUrl || '');
  }, []);

  useEffect(() => {
    fetchCompanyFeedUrl();
  }, [fetchCompanyFeedUrl]);

  const handleCopyCompanyFeedUrl = useCallback(async () => {
    if (!companyFeedUrl) {
      message.warning('Bạn cần bấm "Lấy link chia sẻ" trước.');
      return;
    }
    const ok = await copyText(companyFeedUrl);
    if (!ok) {
      message.error('Không thể copy tự động. Vui lòng copy thủ công link hiển thị bên trái.');
      return;
    }
    setCompanyFeedCopied(true);
    setTimeout(() => setCompanyFeedCopied(false), 1500);
    message.success('Đã copy link Google Calendar');
  }, [companyFeedUrl]);

  const handleResyncGoogleCalendar = useCallback(async () => {
    setResyncLoading(true);
    const { data, error } = await api.post('/google-calendar/resync');
    setResyncLoading(false);
    if (error) {
      setResyncResult({ ok: false, message: error.message || 'Resync thất bại' });
      message.error(error.message || 'Resync thất bại');
      return;
    }
    setResyncResult({
      ok: true,
      total: data?.total ?? 0,
      synced: data?.synced ?? 0,
      failed: data?.failed ?? 0,
    });
    message.success('Resync Google Calendar hoàn tất');
  }, []);

  const messages = {
    today: 'Hôm nay',
    previous: 'Trước',
    next: 'Sau',
    month: 'Tháng',
    week: 'Tuần',
    day: 'Ngày',
    agenda: 'Lịch trình',
    noEventsInRange: 'Không có sự kiện nào trong khoảng thời gian này.',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Lịch Bảo trì
        </Title>
        <Space>
          <Select
            placeholder="Lọc loại"
            style={{ width: 180 }}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v ?? '')}
            options={[
              { value: '', label: 'Tất cả' },
              { value: 'schedule', label: 'Bảo trì định kỳ' },
              { value: 'report', label: 'Báo lỗi' },
            ]}
          />
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Mức độ (báo lỗi):</span>
          {Object.entries(PRIORITY_MAP).map(([key, label]) => (
            <Tag key={key} color={PRIORITY_COLORS[key]}>
              {label}
            </Tag>
          ))}
          <Tag color="cyan">Lịch định kỳ</Tag>
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>Đồng bộ lịch với Google Calendar</div>
              <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                {companyFeedLoading
                  ? 'Đang tải link chia sẻ...'
                  : companyFeedUrl
                    ? 'Đã sẵn sàng link chia sẻ lịch'
                    : 'Chưa lấy được link chia sẻ'}
              </div>
            </div>
            <Space>
              <Button
                type={companyFeedCopied ? 'default' : 'primary'}
                disabled={!companyFeedUrl || companyFeedLoading}
                onClick={handleCopyCompanyFeedUrl}
              >
                {companyFeedCopied ? 'Đã copy' : 'Copy link chia sẻ'}
              </Button>
            </Space>
          </div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>
            Dùng link chia sẻ để mở trực tiếp Google Calendar và thêm lịch dùng chung.
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Admin: Resync Google Calendar</div>
                <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                  {resyncResult
                    ? resyncResult.ok
                      ? `Tổng ${resyncResult.total}, synced ${resyncResult.synced}, lỗi ${resyncResult.failed}`
                      : resyncResult.message
                    : 'Đồng bộ lại toàn bộ lịch cũ một lần'}
                </div>
              </div>
              <Button type="primary" loading={resyncLoading} onClick={handleResyncGoogleCalendar}>
                Resync ngay
              </Button>
            </div>
          )}
        </Space>
      </Card>

      <Spin spinning={loading}>
        <div style={{ height: 650 }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            messages={messages}
            views={['month', 'week', 'day', 'agenda']}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            popup
          />
        </div>
      </Spin>

      <Modal
        title={selectedEvent?.source === 'schedule' ? 'Chi tiết lịch bảo trì' : 'Chi tiết báo lỗi'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedEvent?.source === 'schedule' ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Tiêu đề" span={2}>
              {selectedEvent.title}
            </Descriptions.Item>
            <Descriptions.Item label="Thang máy">{selectedEvent.elevator_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Khách hàng">
              {selectedEvent.customer_id ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setModalOpen(false);
                    navigate(`/customers/${selectedEvent.customer_id}/detail`, {
                      state: { returnToCalendarWithScheduleId: selectedEvent.id },
                    });
                  }}
                >
                  {selectedEvent.customer_name || '-'}
                </Button>
              ) : (
                selectedEvent.customer_name || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Hợp đồng">
              {selectedEvent.contract_id ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setModalOpen(false);
                    navigate(`/contracts/${selectedEvent.contract_id}/detail`, {
                      state: { returnToCalendarWithScheduleId: selectedEvent.id },
                    });
                  }}
                >
                  {selectedEvent.contract_number || '-'}
                </Button>
              ) : (
                selectedEvent.contract_number || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bảo trì">{formatDateDMY(selectedEvent.scheduled_date)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {selectedEvent.status === 'planned' ? 'Dự kiến' : selectedEvent.status === 'completed' ? 'Đã thực hiện' : 'Đã hủy'}
            </Descriptions.Item>
            <Descriptions.Item label="" span={2}>
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  setModalOpen(false);
                  navigate(`/maintenance-orders/schedule/${selectedEvent.id}/detail`);
                }}
              >
                Xem đơn bảo trì
              </Button>
            </Descriptions.Item>
          </Descriptions>
        ) : selectedEvent ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Tiêu đề" span={2}>
              {selectedEvent.title}
            </Descriptions.Item>
            <Descriptions.Item label="Loại">
              <Tag color={selectedEvent.type === 'warranty' ? 'orange' : 'blue'}>
                {TYPE_MAP[selectedEvent.type]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Mức độ">
              <Tag color={PRIORITY_COLORS[selectedEvent.priority]}>{PRIORITY_MAP[selectedEvent.priority]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {STATUS_MAP[selectedEvent.status]}
            </Descriptions.Item>
            <Descriptions.Item label="Thang máy">
              {selectedEvent.elevators?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng">
              {selectedEvent.customer_id ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setModalOpen(false);
                    navigate(`/customers/${selectedEvent.customer_id}/detail`, {
                      state: { returnToCalendarWithErrorReportId: selectedEvent.id },
                    });
                  }}
                >
                  {selectedEvent.customers?.name || '-'}
                </Button>
              ) : (
                selectedEvent.customers?.name || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Hợp đồng">
              {selectedEvent.contract_id ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setModalOpen(false);
                    navigate(`/contracts/${selectedEvent.contract_id}/detail`, {
                      state: { returnToCalendarWithErrorReportId: selectedEvent.id },
                    });
                  }}
                >
                  {selectedEvent.contracts?.contract_number || '-'}
                </Button>
              ) : (
                selectedEvent.contracts?.contract_number || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày báo cáo">
              {formatDateDMY(selectedEvent.reported_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày hẹn">
              {formatDateDMY(selectedEvent.scheduled_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày hoàn thành">
              {formatDateDMY(selectedEvent.completed_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả" span={2}>
              {selectedEvent.description || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
