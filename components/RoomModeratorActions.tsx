"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Crown, MoreVertical, Shield, UserX } from 'lucide-react';
import { useUser } from '@/lib/store/user';
import { toast } from 'sonner';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useRoomContext } from '@/lib/store/RoomContext';

interface RoomMember {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RoomModeratorActionsProps {
  roomId: string;
  ownerId: string;
  members: RoomMember[];
}

export default function RoomModeratorActions({ 
  roomId, 
  ownerId,
  members 
}: RoomModeratorActionsProps) {
  const { user } = useUser();
  const { switchRoom } = useRoomContext();
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);
  const isOwner = user?.id === ownerId;

  const handleTransferOwnership = async () => {
    if (!selectedMember) return;

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc('transfer_room_ownership', {
        p_room_id: roomId,
        p_new_owner_id: selectedMember.id,
        p_current_owner_id: user.id
      });

      if (error) throw error;

      toast.success(`Room ownership transferred to ${selectedMember.username}`);
      setIsTransferOpen(false);
      setSelectedMember(null);
    } catch (error) {
      toast.error('Failed to transfer ownership');
      console.error('Error:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc('leave_room', {
        p_room_id: roomId,
        p_user_id: memberId
      });

      if (error) throw error;

      toast.success('Member removed from room');
    } catch (error) {
      toast.error('Failed to remove member');
      console.error('Error:', error);
    }
  };

  if (!isOwner) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setIsTransferOpen(true)}
          >
            <Crown className="mr-2 h-4 w-4" />
            <span>Transfer Ownership</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Room Ownership</DialogTitle>
            <DialogDescription>
              Select a member to transfer room ownership to. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {members
              .filter(m => m.id !== user?.id)
              .map(member => (
                <div 
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      {member.display_name?.[0] || member.username[0]}
                    </div>
                    <div>
                      <p className="font-medium">{member.display_name || member.username}</p>
                      <p className="text-sm text-muted-foreground">@{member.username}</p>
                    </div>
                  </div>

                  <Button
                    variant={selectedMember?.id === member.id ? "default" : "outline"}
                    onClick={() => setSelectedMember(member)}
                  >
                    {selectedMember?.id === member.id ? (
                      <Shield className="h-4 w-4" />
                    ) : (
                      <Crown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsTransferOpen(false);
                setSelectedMember(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferOwnership}
              disabled={!selectedMember}
            >
              Transfer Ownership
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}