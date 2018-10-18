export default interface IMarketTicker {
  Name: string
  BaseCurrency: string
  MarketCurrency: string
  ReceivedOn: Date
  BaseVolume: number
  Exchange: string
  Ask: number
  Bid: number
  Last: number
  WriteDate: Date
}
