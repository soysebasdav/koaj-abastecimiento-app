export type MaterialType =
  | 'fabric'
  | 'button'
  | 'pocket_fabric'
  | 'label'
  | 'zipper'
  | 'thread'
  | 'packaging'
  | 'other'

export type MaterialUnit =
  | 'meter'
  | 'unit'
  | 'kg'
  | 'roll'
  | 'box'
  | 'package'

export type RecordStatus = 'active' | 'inactive'

export type CollectionStatus = 'draft' | 'active' | 'closed' | 'archived'

export type ForecastSource =
  | 'manual'
  | 'excel_import'
  | 'commercial'
  | 'internal_adjustment'