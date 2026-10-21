import { isHttpsUrl, isMeetingUrl, isWhatsappGroupUrl, isZoomUrl } from './urls';

describe('urls', () => {
  it('isMeetingUrl: zoom.us (y subdominios) o meet.google.com, solo https', () => {
    expect(isMeetingUrl('https://us02web.zoom.us/j/123?pwd=x')).toBe(true);
    expect(isMeetingUrl('https://zoom.us/j/1')).toBe(true);
    expect(isMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isMeetingUrl('http://zoom.us/j/1')).toBe(false);
    expect(isMeetingUrl('https://evilzoom.us/j/1')).toBe(false);
    expect(isMeetingUrl('https://teams.microsoft.com/x')).toBe(false);
    expect(isMeetingUrl('no es url')).toBe(false);
  });

  it('isZoomUrl solo acepta Zoom', () => {
    expect(isZoomUrl('https://zoom.us/j/1')).toBe(true);
    expect(isZoomUrl('https://meet.google.com/abc')).toBe(false);
  });

  it('isWhatsappGroupUrl exige chat.whatsapp.com con código', () => {
    expect(isWhatsappGroupUrl('https://chat.whatsapp.com/AbCdEf123')).toBe(true);
    expect(isWhatsappGroupUrl('https://chat.whatsapp.com/')).toBe(false);
    expect(isWhatsappGroupUrl('https://wa.me/5215512345678')).toBe(false);
  });

  it('isHttpsUrl', () => {
    expect(isHttpsUrl('https://youtu.be/x')).toBe(true);
    expect(isHttpsUrl('ftp://x')).toBe(false);
  });
});
