import { test, expect } from 'bun:test';
import { SITE_TEMPLATES, templateById } from '../src/components/sites/siteTemplates';
import { templateSampleHtml } from '../src/components/sites/siteTemplateSample';

test('catálogo de templates de Sites contém todos os 17 modelos completos e fiéis', () => {
  expect(SITE_TEMPLATES).toHaveLength(17);
  const squared = templateById('squared');
  expect(squared).toBeDefined();
  expect(squared?.name).toBe('Squared');

  const html = templateSampleHtml(squared!);
  expect(html).toContain('<!doctype html>');
  expect(html).toContain('Space Grotesk');
  expect(html).toContain('Figtree');
  expect(html).toContain('JetBrains Mono');
  expect(html).toContain('class="mega-nav"');
  expect(html).toContain('id="lab-b-portal"');
  expect(html).toContain('data-bouncy-tabs-init');
  expect(html).toContain('data-feature-pills-init');
  expect(html).toContain('Watch our showreel');
  expect(html).toContain('class="cases-board"');
  expect(html).toContain('data-radial-slider-init');
  expect(html).toContain('data-stacking-cards-init');
  expect(html).toContain('id="tarieven"');
  expect(html).toContain('id="team"');
  expect(html).toContain('class="sq-footer-hole');
  expect(html).toContain('dialog data-lenis-prevent="" data-view="choose" aria-labelledby="sq-plancall-title" class="sq-plancall"');

  const isomeet = templateById('isomeet');
  expect(isomeet).toBeDefined();
  expect(isomeet?.name).toBe('ISO Meet');

  const isoHtml = templateSampleHtml(isomeet!);
  expect(isoHtml.toLowerCase()).toContain('<!doctype html>');
  expect(isoHtml).toContain('Instrument Serif');
  expect(isoHtml).toContain('Instrument Sans');
  expect(isoHtml).toContain('class="italic-letter-span"');
  expect(isoHtml).toContain('class="swiper hero-main-slider"');
  expect(isoHtml).toContain('class="swiper hero-second-slider"');
  expect(isoHtml).toContain('id="why"');
  expect(isoHtml).toContain('id="who"');
  expect(isoHtml).toContain('class="marquee with-reverse"');
  expect(isoHtml).toContain('id="features"');
  expect(isoHtml).toContain('data-w-tab="Tab 1"');
  expect(isoHtml).toContain('data-w-tab="Tab 2"');
  expect(isoHtml).toContain('id="reserve-username"');
  expect(isoHtml).toContain('faq-dd');
  expect(isoHtml).toContain('id="join-waitlist"');

  const visuvate = templateById('visuvate');
  expect(visuvate).toBeDefined();
  expect(visuvate?.name).toBe('Visuvate');

  const vvHtml = templateSampleHtml(visuvate!);
  expect(vvHtml.toLowerCase()).toContain('<!doctype html>');
  expect(vvHtml).toContain('Fraunces');
  expect(vvHtml).toContain('Geist');
  expect(vvHtml).toContain('vv-gradient-bar');
  expect(vvHtml).toContain('hh-editor');
  expect(vvHtml).toContain('id="works"');
  expect(vvHtml).toContain('data-vv-coil-world');
  expect(vvHtml).toContain('id="services"');
  expect(vvHtml).toContain('id="pricing"');
  expect(vvHtml).toContain('id="approach"');
  expect(vvHtml).toContain('id="testimonials"');
  expect(vvHtml).toContain('id="faqs"');

  const marcus = templateById('marcus');
  expect(marcus).toBeDefined();
  expect(marcus?.name).toBe('Marcus Lorenzet');
  const marcusHtml = templateSampleHtml(marcus!);
  expect(marcusHtml.toLowerCase()).toContain('<!doctype html>');
  expect(marcusHtml).toContain('Marcus Lorenzet');
  expect(marcusHtml).toContain('15+ YEARS OF EXPERIENCE');

  const kstoimenov = templateById('kstoimenov');
  expect(kstoimenov).toBeDefined();
  expect(kstoimenov?.name).toBe('Krasi Stoimenov');
  const ksHtml = templateSampleHtml(kstoimenov!);
  expect(ksHtml.toLowerCase()).toContain('<!doctype html>');
  expect(ksHtml).toContain('data-hero-shader');
  expect(ksHtml).toContain('id="works"');
  expect(ksHtml).toContain('id="services"');

  const avecanni = templateById('avecanni');
  expect(avecanni).toBeDefined();
  expect(avecanni?.name).toBe('Avec Anni');
  const avecHtml = templateSampleHtml(avecanni!);
  expect(avecHtml.toLowerCase()).toContain('<!doctype html>');
  expect(avecHtml).toContain('Your work is good.');
  expect(avecHtml).toContain('Two services.');

  const oxigen = templateById('oxigen');
  expect(oxigen).toBeDefined();
  expect(oxigen?.name).toBe('Oxigen');
  const oxHtml = templateSampleHtml(oxigen!);
  expect(oxHtml.toLowerCase()).toContain('<!doctype html>');
  expect(oxHtml).toContain('id="story"');
  expect(oxHtml).toContain('id="startups"');
  expect(oxHtml).toContain('id="research"');

  const ballance = templateById('ballance');
  expect(ballance).toBeDefined();
  expect(ballance?.name).toBe('Ballance');
  const balHtml = templateSampleHtml(ballance!);
  expect(balHtml.toLowerCase()).toContain('<!doctype html>');
  expect(balHtml).toContain('Move payments without friction');
  expect(balHtml).toContain('What Ballance* Does');

  const williams = templateById('williams');
  expect(williams).toBeDefined();
  expect(williams?.name).toBe('Williams GP Tech');
  const wilHtml = templateSampleHtml(williams!);
  expect(wilHtml.toLowerCase()).toContain('<!doctype html>');
  expect(wilHtml).toContain('Williams Grand Prix Technologies');
  expect(wilHtml).toContain('big-tabs_menu');

  const grainient = templateById('grainient');
  expect(grainient).toBeDefined();
  expect(grainient?.name).toBe('Grainient');
  const grHtml = templateSampleHtml(grainient!);
  expect(grHtml.toLowerCase()).toContain('<!doctype html>');
  expect(grHtml).toContain('Grainient');
  expect(grHtml).toContain('Section - Hero');

  const ciaoenergy = templateById('ciaoenergy');
  expect(ciaoenergy).toBeDefined();
  expect(ciaoenergy?.name).toBe('Ciao Energy');
  const ciaoHtml = templateSampleHtml(ciaoenergy!);
  expect(ciaoHtml.toLowerCase()).toContain('<!doctype html>');
  expect(ciaoHtml).toContain('id="gamme"');
  expect(ciaoHtml).toContain('id="FAQ"');

  const neoconda = templateById('neoconda');
  expect(neoconda).toBeDefined();
  expect(neoconda?.name).toBe('Neoconda');
  const neoHtml = templateSampleHtml(neoconda!);
  expect(neoHtml.toLowerCase()).toContain('<!doctype html>');
  expect(neoHtml).toContain('Neoconda');
  expect(neoHtml).toContain('neoconda-webflow-shared');

  const trionn = templateById('trionn');
  expect(trionn).toBeDefined();
  expect(trionn?.name).toBe('TRIONN');
  const triHtml = templateSampleHtml(trionn!);
  expect(triHtml.toLowerCase()).toContain('<!doctype html>');
  expect(triHtml).toContain('trionn-bundled-css');
  expect(triHtml).toContain('id="vision-section"');
  expect(triHtml).toContain('id="keyfacts-section"');

  const storia = templateById('storia');
  expect(storia).toBeDefined();
  expect(storia?.name).toBe('Storia OSI');
  const stoHtml = templateSampleHtml(storia!);
  expect(stoHtml.toLowerCase()).toContain('<!doctype html>');
  expect(stoHtml).toContain('Orchestra della Svizzera italiana');
  expect(stoHtml).toContain('storia-slater-inline');

  const getblue = templateById('getblue');
  expect(getblue).toBeDefined();
  expect(getblue?.name).toBe('Get Blue');
  const blueHtml = templateSampleHtml(getblue!);
  expect(blueHtml.toLowerCase()).toContain('<!doctype html>');
  expect(blueHtml).toContain('Longevity tomorrow');
  expect(blueHtml).toContain('getblue-webflow-shared');

  const coffeetech = templateById('coffeetech');
  expect(coffeetech).toBeDefined();
  expect(coffeetech?.name).toBe('Coffee-Tech');
  const cftHtml = templateSampleHtml(coffeetech!);
  expect(cftHtml.toLowerCase()).toContain('<!doctype html>');
  expect(cftHtml).toContain('Coffee Roasting Reinvented');
  expect(cftHtml).toContain('coffeetech-main-script');

  const flowty = templateById('flowty');
  expect(flowty).toBeDefined();
  expect(flowty?.name).toBe('Flowty');
  const flwHtml = templateSampleHtml(flowty!);
  expect(flwHtml.toLowerCase()).toContain('<!doctype html>');
  expect(flwHtml).toContain('Flowty - Minimalist Focus-Break Timer to Silence Digital Noise');
  expect(flwHtml).toContain('flowty-bundled-css');
});
