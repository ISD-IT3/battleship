const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();

// Защита исходников: отдаем ТОЛЬКО содержимое папки public/
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Хранилище комнат в памяти
const rooms = new Map();

// Хелперы валидации входных данных
const isValidCell = (i) => Number.isInteger(i) && i >= 0 && i < 100;
const isValidResult = (r) => ['miss', 'hit', 'sunk'].includes(r);
const isValidCode = (c) => typeof c === 'string' && /^[a-z0-9]{3,12}$/i.test(c);

io.on('connection', (socket) => {

  // 1. Создание или вход в комнату (Роли назначает СЕРВЕР)
  socket.on('join_room', (rawCode) => {
    try {
      const code = typeof rawCode === 'string' ? rawCode.trim().toLowerCase() : '';
      if (!isValidCode(code)) {
        return socket.emit('error_msg', 'Некорректный код комнаты');
      }

      let room = rooms.get(code);

      // Если комнаты нет — создаем её (создатель = host)
      if (!room) {
        room = {
          code,
          players: new Map(), // socketId -> { role, ready, hash, ships }
          disconnectTimers: new Map()
        };
        rooms.set(code, room);
      }

      // Защита от переполнения комнаты (Максимум 2 игрока)
      if (room.players.size >= 2 && !room.players.has(socket.id)) {
        return socket.emit('error_msg', 'Комната заполнена (максимум 2 игрока)');
      }

      // Отмена таймера дисконнекта, если игрок переподключился
      if (room.disconnectTimers.has(socket.id)) {
        clearTimeout(room.disconnectTimers.get(socket.id));
        room.disconnectTimers.delete(socket.id);
      }

      // Назначаем роль: первый = host ('h'), второй = guest ('g')
      // Роль: берём свободную (если хост вышел, новый игрок станет host)
      const taken = new Set(Array.from(room.players.values()).map(p => p.role));
      const role = room.players.has(socket.id)
        ? room.players.get(socket.id).role
        : (taken.has('h') ? 'g' : 'h');

      room.players.set(socket.id, {
        role,
        ready: false,
        hash: '',
        ships: null
      });

      // Запоминаем комнату в контексте сокета
      socket.data.room = code;
      socket.data.role = role;
      socket.join(code);

      // Отправляем игроку его назначенную роль
      socket.emit('init_role', { role, code });

      // Оповещаем комнату о количестве участников
      io.to(code).emit('peer_count', room.players.size);

    } catch (err) {
      console.error('Ошибка в join_room:', err);
    }
  });

  // 2. Сигнал готовности расстановки
  socket.on('sb_ready', (data) => {
    try {
      const code = socket.data.room;
      if (!code || !rooms.has(code)) return;
      const room = rooms.get(code);
      const player = room.players.get(socket.id);
      if (!player) return;

      player.ready = true;
      player.hash = typeof data?.h === 'string' ? data.h : '';

      socket.to(code).emit('sb_ready_hash', { h: player.hash });

      // Если оба игрока в комнате готовы — запуск игры
      if (room.players.size === 2) {
        const allReady = Array.from(room.players.values()).every(p => p.ready);
        if (allReady) {
          io.to(code).emit('sb_start');
        }
      }
    } catch (err) {
      console.error('Ошибка в sb_ready:', err);
    }
  });

  // 3. Выстрел (Только внутри своей комнаты)
  socket.on('sb_shot', (data) => {
    try {
      const code = socket.data.room;
      if (!code || !isValidCell(data?.i)) return;
      
      // Пересылаем выстрел исключительно сопернику по комнате
      socket.to(code).emit('sb_shot', { i: data.i });
    } catch (err) {
      console.error('Ошибка в sb_shot:', err);
    }
  });

  // 4. Результат выстрела с валидацией строк
  socket.on('sb_res', (data) => {
    try {
      const code = socket.data.room;
      if (!code || !isValidCell(data?.i) || !isValidResult(data?.r)) return;

      const payload = { i: data.i, r: data.r };
      if (data.r === 'sunk' && Array.isArray(data.ship)) {
        payload.ship = data.ship.filter(isValidCell);
      }

      socket.to(code).emit('sb_res', payload);
    } catch (err) {
      console.error('Ошибка в sb_res:', err);
    }
  });

  // 5. Завершение партии / Раскрытие флота
  socket.on('sb_end', (data) => {
    try {
      const code = socket.data.room;
      if (!code || !rooms.has(code)) return;

      const payload = {
        ships: Array.isArray(data?.ships) ? data.ships : [],
        salt: typeof data?.salt === 'string' ? data.salt : '',
        gu: !!data?.gu
      };

      socket.to(code).emit('sb_end', payload);
    } catch (err) {
      console.error('Ошибка в sb_end:', err);
    }
  });

  // 6. Обработка отключения и таймер технического поражения (60 сек)
  socket.on('disconnecting', () => {
    try {
      const code = socket.data.room;
      if (!code || !rooms.has(code)) return;

      const room = rooms.get(code);
      room.players.delete(socket.id);

      if (room.players.size === 0) {
        rooms.delete(code);
      } else {
        io.to(code).emit('peer_left');

        // Таймер ожидания 60 секунд до автоматической победы оставшегося
        const timer = setTimeout(() => {
          io.to(code).emit('peer_abandoned');
          rooms.delete(code);
        }, 60000);

        room.disconnectTimers.set(socket.id, timer);
      }
    } catch (err) {
      console.error('Ошибка в disconnect:', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`=== Сервер запущен: http://localhost:${PORT} ===`));