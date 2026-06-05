export type ForecastView = {
  id: string
  collectionId: string
  collectionCode: string
  collectionName: string
  fitId: string
  fitCode: string
  fitName: string
  fitCategory: string | null
  periodMonth: string
  projectedUnits: number
  versionLabel: string
  source: 'manual' | 'excel_import' | 'commercial' | 'internal_adjustment'
  status: 'draft' | 'active' | 'replaced'
  changeReason: string | null
}

export type ForecastFormInput = {
  collection_id: string
  fit_id: string
  period_month: string
  projected_units: string
  version_label: string
  source: ForecastView['source']
  status: ForecastView['status']
  change_reason: string
}

export type MonthForwardForecastInput = {
  collection_id: string
  fit_id: string
  from_month: string
  to_month: string
  projected_units: string
  version_label: string
  source: ForecastView['source']
  change_reason: string
}

export type CollectionOption = {
  id: string
  code: string
  name: string
  start_month: string
  end_month: string
}

export type FitOption = {
  id: string
  code: string
  name: string
  category: string | null
}

export type ForecastFormOptions = {
  collections: CollectionOption[]
  fits: FitOption[]
}
