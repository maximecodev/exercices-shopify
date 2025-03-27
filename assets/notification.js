const closeNotification = document.querySelector('.notification__close');
closeNotification.addEventListener('click', () => {
  const notification = document.querySelector('.notification');
  notification.remove();
});
