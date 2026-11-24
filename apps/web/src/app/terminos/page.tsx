'use client';

import { NOMBRE_RESTAURANTE } from '@/components/marca';
import { PaginaPublica } from '@/components/pagina-publica';
import { idiomaActual, t } from '@/lib/i18n';

/** Términos de uso del sistema. Es un texto base que el negocio debe revisar */
export default function Terminos() {
  return (
    <PaginaPublica titulo={t('Términos y condiciones')}>
      {idiomaActual() === 'en' ? (
        <>
          <p>This system is for the exclusive use of the staff of {NOMBRE_RESTAURANTE}. Accounts are personal and are created by the administrator.</p>
          <ul>
            <li>Do not share your password. If you think someone else knows it, change it or ask the administrator to change it.</li>
            <li>Use “Keep me signed in” only on your own devices.</li>
            <li>Every order, payment and cash register movement is recorded with the name of the person who made it.</li>
            <li>Access may be suspended if the system is misused.</li>
          </ul>
          <p>Customers order through the WhatsApp and Telegram chatbot; prices and availability are those shown by the chatbot when the order is confirmed.</p>
        </>
      ) : (
        <>
          <p>Este sistema es de uso exclusivo del personal de {NOMBRE_RESTAURANTE}. Las cuentas son personales y las crea el administrador.</p>
          <ul>
            <li>No compartas tu contraseña. Si crees que alguien más la conoce, cámbiala o pídele al administrador que la cambie.</li>
            <li>Usa «Mantener la sesión iniciada» solo en tus propios equipos.</li>
            <li>Cada pedido, cobro y movimiento de caja queda registrado con el nombre de quien lo hizo.</li>
            <li>El acceso se puede suspender si se usa el sistema de forma indebida.</li>
          </ul>
          <p>Los clientes piden por el chatbot de WhatsApp y Telegram; los precios y la disponibilidad son los que muestra el chatbot al confirmar el pedido.</p>
        </>
      )}
    </PaginaPublica>
  );
}
