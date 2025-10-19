import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Contact {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  lid?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  notify?: string;

  @Column({ nullable: true })
  verifiedName?: string;

  @Column({ nullable: true })
  imgUrl?: string | "changed";

  @Column({ nullable: true })
  status?: string;
}
