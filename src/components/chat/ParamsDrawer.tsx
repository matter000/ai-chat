import { Drawer } from '@/components/ui/Drawer';
import { ConversationParams } from '@/components/settings/ConversationParams';

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId?: string;
}

export function ParamsDrawer({ open, onClose, conversationId }: Props) {
  return (
    <Drawer open={open} onClose={onClose} title="会话参数" width={360}>
      <ConversationParams conversationId={conversationId} onClose={onClose} />
    </Drawer>
  );
}