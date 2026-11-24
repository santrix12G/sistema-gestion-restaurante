'use client';

import { CONTACTO, PaginaPublica } from '@/components/pagina-publica';
import { idiomaActual, t } from '@/lib/i18n';

/** Declaración de accesibilidad: qué se hizo para cumplir WCAG 2.1 AA (Anexo 1 de la Resolución 1519 de 2020) y cómo reportar barreras */
export default function Accesibilidad() {
  const canal = CONTACTO.correo ?? CONTACTO.telefono;
  return (
    <PaginaPublica titulo={t('Declaración de accesibilidad')}>
      {idiomaActual() === 'en' ? (
        <>
          <p>
            This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.1, level AA, the standard required in Colombia by Resolution 1519 of
            2020 of MinTIC.
          </p>
          <h2>What you can do</h2>
          <ul>
            <li>Make the text bigger (up to 150 %) with the A+ button, or zoom up to 200 % in your browser without losing content.</li>
            <li>Turn on high contrast with the contrast button.</li>
            <li>Switch the language between Spanish and English.</li>
            <li>Use the whole site with the keyboard: Tab moves between elements and the focus is always visible. “Skip to main content” is the first link.</li>
          </ul>
          <h2>How it is built</h2>
          <ul>
            <li>Each page declares its language and has a descriptive title.</li>
            <li>Forms have visible labels and clear error messages.</li>
            <li>Icons have a text alternative, and information is never conveyed by color alone.</li>
            <li>The security check (captcha) usually solves itself, with no images or puzzles.</li>
            <li>Sessions do not expire while you work for up to 12 hours, and you can keep them open for 30 days.</li>
          </ul>
          <h2>Report a barrier</h2>
          <p>If something is hard to use, tell us{canal ? ` at ${canal}` : ''} and we will fix it.</p>
        </>
      ) : (
        <>
          <p>
            Este sitio busca cumplir las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1 en nivel AA, el estándar que exige en Colombia la
            Resolución 1519 de 2020 del MinTIC.
          </p>
          <h2>Qué puedes hacer</h2>
          <ul>
            <li>Agrandar la letra (hasta 150 %) con el botón A+, o ampliar hasta 200 % en el navegador sin perder contenido.</li>
            <li>Activar el contraste alto con el botón de contraste.</li>
            <li>Cambiar el idioma entre español e inglés.</li>
            <li>Usar todo el sitio con el teclado: Tab pasa entre los elementos y el foco siempre se ve. «Saltar al contenido principal» es el primer enlace.</li>
          </ul>
          <h2>Cómo está hecho</h2>
          <ul>
            <li>Cada página declara su idioma y tiene un título que la describe.</li>
            <li>Los formularios tienen etiquetas visibles y mensajes de error claros.</li>
            <li>Los íconos tienen texto alternativo y ninguna información depende solo del color.</li>
            <li>La verificación de seguridad (captcha) casi siempre se resuelve sola, sin imágenes ni acertijos.</li>
            <li>La sesión no vence mientras trabajas durante 12 horas, y puedes mantenerla abierta 30 días.</li>
          </ul>
          <h2>Reporta una barrera</h2>
          <p>Si algo es difícil de usar, cuéntanos{canal ? ` en ${canal}` : ''} y lo corregimos.</p>
        </>
      )}
    </PaginaPublica>
  );
}
