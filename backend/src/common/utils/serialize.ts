import { serializeAcademicProfile } from './academic';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
  presenceStatus: true,
  academicProfile: { include: { course: true } },
} as const;

/** Select enxuto usado no chat, onde perfil acadêmico não é necessário. */
export const chatUserSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
} as const;

export function isUserOnline(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
}

type PublicUserRow = {
  id: string;
  name: string | null;
  username: string | null;
  displayId: string;
  image: string | null;
  lastSeenAt: Date | null;
  presenceStatus: string;
  academicProfile?: Parameters<typeof serializeAcademicProfile>[0];
};

export function serializePublicUser(user: PublicUserRow) {
  const online = isUserOnline(user.lastSeenAt);

  return {
    id: user.id,
    name: user.name ?? 'Usuário',
    username: user.username,
    displayId: user.displayId,
    image: user.image,
    online,
    presenceStatus: online ? user.presenceStatus : 'OFFLINE',
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    academic: serializeAcademicProfile(user.academicProfile),
  };
}

/** Select Prisma compartilhado: listagens de livro NUNCA carregam `coverBlob`. */
export const bookListSelect = {
  id: true,
  title: true,
  author: true,
  isbn: true,
  rating: true,
  coverUrl: true,
  coverMime: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { notes: true, comments: true } },
} as const;

type BookListRow = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  rating: number | null;
  coverUrl: string | null;
  coverMime: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { notes: number; comments: number };
};

export function serializeBookListItem(
  book: BookListRow,
  opts?: { hideNotesCount?: boolean },
) {
  const hasUploadedCover = book.coverMime != null;
  const hideNotes = opts?.hideNotesCount ?? false;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    rating: book.rating,
    coverUrl: book.coverUrl,
    hasCover: Boolean(book.coverUrl?.trim()) || hasUploadedCover,
    coverImageHref: hasUploadedCover
      ? `/api/books/${book.id}/cover`
      : book.coverUrl?.trim() || null,
    notesCount: hideNotes ? 0 : (book._count?.notes ?? 0),
    commentsCount: book._count?.comments ?? 0,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

export function isValidHttpCoverUrl(url: string | null | undefined): boolean {
  if (url == null || url.trim() === '') return true;
  return /^https?:\/\//i.test(url.trim());
}

type ChatUserRow = {
  id: string;
  name: string | null;
  username: string | null;
  displayId: string;
  image: string | null;
  lastSeenAt: Date | null;
};

type MessageRow = {
  id: string;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  senderId: string;
  recipientId: string | null;
  groupId: string | null;
  createdAt: Date;
  sender: ChatUserRow;
};

/** Formato único de mensagem, compartilhado entre DM e grupo. */
export function serializeMessage(message: MessageRow) {
  return {
    id: message.id,
    content: message.content,
    attachmentUrl: message.attachmentUrl,
    attachmentType: message.attachmentType,
    attachmentName: message.attachmentName,
    senderId: message.senderId,
    sender: {
      ...message.sender,
      online: isUserOnline(message.sender.lastSeenAt),
    },
    recipientId: message.recipientId,
    groupId: message.groupId,
    createdAt: message.createdAt.toISOString(),
  };
}

type GroupMemberRow = {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Date;
  user: ChatUserRow;
};

export function serializeGroupMember(member: GroupMemberRow) {
  return {
    id: member.id,
    groupId: member.groupId,
    userId: member.userId,
    user: { ...member.user, online: isUserOnline(member.user.lastSeenAt) },
    joinedAt: member.joinedAt.toISOString(),
  };
}

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  adminId: string;
  coAdminId: string | null;
  admin: ChatUserRow;
  coAdmin: ChatUserRow | null;
  members: GroupMemberRow[];
  createdAt: Date;
  updatedAt: Date;
};

export function serializeGroup(group: GroupRow) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    adminId: group.adminId,
    coAdminId: group.coAdminId,
    admin: { ...group.admin, online: isUserOnline(group.admin.lastSeenAt) },
    coAdmin: group.coAdmin
      ? { ...group.coAdmin, online: isUserOnline(group.coAdmin.lastSeenAt) }
      : null,
    members: group.members.map(serializeGroupMember),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}
