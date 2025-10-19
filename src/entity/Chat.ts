import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Chat {
  @PrimaryColumn()
  id: string;

  @Column({ type: "text", nullable: false })
  data: string;
}
