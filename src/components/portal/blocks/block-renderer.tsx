import type { DeliveryAddressConfirmation, PortalBlock, PortalFileUpload, Status } from '@/types';
import { CurrentStatusBlock } from './current-status-block';
import { PocInfoBlock } from './poc-info-block';
import { StatusHistoryBlock } from './status-history-block';
import { CustomerScheduleBlock } from './customer-schedule-block';
import { CustomHtmlBlock } from './custom-html-block';
import { FileUploadBlock } from './file-upload-block';
import { DeliveryAddressConfirmationBlock } from './delivery-address-confirmation-block';

export interface PortalProjectData {
  project: {
    id: string;
    client_name: string;
    sales_order_number: string | null;
    poc_name: string | null;
    poc_email: string | null;
    poc_phone: string | null;
    start_date: string | null;
    end_date: string | null;
    delivery_street: string | null;
    delivery_city: string | null;
    delivery_state: string | null;
    delivery_zip: string | null;
    delivery_country: string | null;
  };
  currentStatus: Status | null;
  filteredStatuses: Status[];
  isOnHold: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientVisibleHistory: any[];
  projectToken: string;
  fileUploads: PortalFileUpload[];
  addressConfirmation: DeliveryAddressConfirmation | null;
}

interface BlockRendererProps {
  block: PortalBlock;
  data: PortalProjectData;
}

export function BlockRenderer({ block, data }: BlockRendererProps) {
  switch (block.type) {
    case 'current_status':
      return (
        <CurrentStatusBlock
          project={data.project}
          currentStatus={data.currentStatus}
          filteredStatuses={data.filteredStatuses}
          isOnHold={data.isOnHold}
        />
      );
    case 'poc_info':
      return <PocInfoBlock project={data.project} />;
    case 'status_history':
      return <StatusHistoryBlock history={data.clientVisibleHistory} />;
    case 'customer_schedule':
      return <CustomerScheduleBlock project={data.project} />;
    case 'custom_html':
      return (
        <CustomHtmlBlock
          content={block.config?.content}
          title={block.config?.title}
        />
      );
    case 'file_upload':
      return (
        <FileUploadBlock
          files={block.config?.files || []}
          projectToken={data.projectToken}
          projectId={data.project.id}
          blockId={block.id}
          existingUploads={data.fileUploads.filter((u) => u.block_id === block.id)}
        />
      );
    case 'delivery_address_confirmation':
      return (
        <DeliveryAddressConfirmationBlock
          project={data.project}
          token={data.projectToken}
          confirmation={data.addressConfirmation}
        />
      );
    default:
      return null;
  }
}
