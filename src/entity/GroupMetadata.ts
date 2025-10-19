import { GroupParticipant, WAMessageAddressingMode } from 'baileys';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class GroupMetadata {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  notify?: string;

  @Column({ nullable: true })
  addressingMode?: WAMessageAddressingMode;

  @Column({ nullable: true })
  owner?: string;

  @Column({ nullable: true })
  ownerPn?: string;

  @Column({ nullable: true })
  owner_country_code?: string;

  @Column()
  subject: string;

  @Column({ nullable: true })
  subjectOwner?: string;

  @Column({ nullable: true })
  subjectOwnerPn?: string;

  @Column({ nullable: true })
  subjectTime?: number;

  @Column({ nullable: true })
  creation?: number;

  @Column({ nullable: true })
  desc?: string;

  @Column({ nullable: true })
  descOwner?: string;

  @Column({ nullable: true })
  descOwnerPn?: string;

  @Column({ nullable: true })
  descId?: string;

  @Column({ nullable: true })
  descTime?: number;

  @Column({ nullable: true })
  linkedParent?: string;

  @Column({ nullable: true })
  restrict?: boolean;

  @Column({ nullable: true })
  announce?: boolean;

  @Column({ nullable: true })
  memberAddMode?: boolean;

  @Column({ nullable: true })
  joinApprovalMode?: boolean;

  @Column({ nullable: true })
  isCommunity?: boolean;

  @Column({ nullable: true })
  isCommunityAnnounce?: boolean;

  @Column({ nullable: true })
  size?: number;

  @Column({ nullable: true, type: "simple-json" })
  participants: GroupParticipant[];

  @Column({ nullable: true })
  ephemeralDuration?: number;

  @Column({ nullable: true })
  inviteCode?: string;

  @Column({ nullable: true })
  author?: string;

  @Column({ nullable: true })
  authorPn?: string;

  @Column({ nullable: true })
  expiredMetadata?: number;
}
