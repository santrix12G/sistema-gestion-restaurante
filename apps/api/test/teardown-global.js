module.exports = async () => {
  await globalThis.__PG__?.stop();
};
