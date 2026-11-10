/* Точка входа. */
import { boot } from './ui/app.js';

function start(){
  boot().catch(err => {
    console.error('[LOOTORA] сбой при запуске:', err);
    const el = document.getElementById('boot');
    if(el){
      el.hidden = false;
      el.innerHTML = `<div style="text-align:center;padding:20px">
        <div class="boot-mark">LOOTORA</div>
        <p class="mut" style="margin-top:12px">Не удалось запустить игру. Подробности — в консоли.</p>
        <pre style="font-size:11px;color:#8F2635;margin-top:10px;white-space:pre-wrap">${String((err && err.message) || err)}</pre>
      </div>`;
    }
  });
}

/* Модули с асинхронной инициализацией могут завершиться после DOMContentLoaded —
   поэтому проверяем состояние документа, а не только вешаем слушателя. */
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start, { once:true });
} else {
  start();
}
