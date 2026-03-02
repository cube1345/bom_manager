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

export interface BomDatabase {
  types: ComponentType[];
  components: ComponentItem[];
}
