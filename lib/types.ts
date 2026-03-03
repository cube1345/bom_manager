export interface ComponentType {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRecord {
  id: string;
  platform: string;
  link: string;
  quantity: number;
  pricePerUnit: number;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentItem {
  id: string;
  typeId: string;
  model: string;
  auxInfo: string;
  note: string;
  warningThreshold: number;
  records: PurchaseRecord[];
  totalQuantity: number;
  lowestPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface PcbBomItem {
  id: string;
  componentId: string;
  quantityPerBoard: number;
  createdAt: string;
  updatedAt: string;
}

export interface PcbItem {
  id: string;
  projectId: string;
  name: string;
  version: string;
  boardQuantity: number;
  note: string;
  items: PcbBomItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BomDatabase {
  types: ComponentType[];
  components: ComponentItem[];
  projects: ProjectItem[];
  pcbs: PcbItem[];
}
