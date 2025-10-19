import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Session {
  @PrimaryColumn()
  name: string;

  @Column({ type: "text", nullable: false })
  data: string;
}
