"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/tasks";

interface CommentData {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string | null;
}

interface CommentItemProps {
  comment: CommentData;
  isOwn: boolean;
}

export function CommentItem({ comment, isOwn }: CommentItemProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-2",
        isOwn ? "bg-accent/5" : "bg-white/[0.02]"
      )}
    >
      {/* Avatar */}
      {comment.user_avatar ? (
        <Image
          src={comment.user_avatar}
          alt={comment.user_name ?? ""}
          width={32}
          height={32}
          className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
          {(comment.user_name ?? "?").charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-text">
            {comment.user_name ?? "Desconocido"}
          </span>
          <span className="text-[10px] text-text-muted">
            {formatRelativeTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-text/80 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
