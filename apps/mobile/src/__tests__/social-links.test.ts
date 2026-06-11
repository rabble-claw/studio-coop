import { socialUrl } from '../lib/social-links'

describe('socialUrl', () => {
  it('returns null for empty or whitespace values', () => {
    expect(socialUrl('instagram', '')).toBeNull()
    expect(socialUrl('instagram', '   ')).toBeNull()
    expect(socialUrl('website', null)).toBeNull()
    expect(socialUrl('website', undefined)).toBeNull()
  })

  it('passes through full http(s) URLs unchanged', () => {
    expect(socialUrl('instagram', 'https://instagram.com/empireaerialarts')).toBe(
      'https://instagram.com/empireaerialarts'
    )
    expect(socialUrl('website', 'http://empireaerial.nz')).toBe('http://empireaerial.nz')
  })

  it('converts bare instagram handles to profile URLs', () => {
    expect(socialUrl('instagram', '@empireaerialarts')).toBe(
      'https://instagram.com/empireaerialarts'
    )
    expect(socialUrl('instagram', 'empireaerialarts')).toBe(
      'https://instagram.com/empireaerialarts'
    )
  })

  it('adds https:// to instagram.com paths missing a scheme', () => {
    expect(socialUrl('instagram', 'instagram.com/empireaerialarts')).toBe(
      'https://instagram.com/empireaerialarts'
    )
    expect(socialUrl('instagram', 'www.instagram.com/empireaerialarts')).toBe(
      'https://www.instagram.com/empireaerialarts'
    )
  })

  it('converts bare facebook page names to page URLs', () => {
    expect(socialUrl('facebook', 'EmpireAerialArts')).toBe(
      'https://facebook.com/EmpireAerialArts'
    )
    expect(socialUrl('facebook', '@EmpireAerialArts')).toBe(
      'https://facebook.com/EmpireAerialArts'
    )
  })

  it('adds https:// to bare website domains', () => {
    expect(socialUrl('website', 'empireaerial.nz')).toBe('https://empireaerial.nz')
    expect(socialUrl('website', 'www.empireaerial.nz/classes')).toBe(
      'https://www.empireaerial.nz/classes'
    )
  })

  it('returns null for website values that are not plausible URLs', () => {
    expect(socialUrl('website', 'ask at front desk')).toBeNull()
  })
})
