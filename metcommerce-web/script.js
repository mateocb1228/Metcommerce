// ===== NAVBAR SCROLL =====
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 30px rgba(0,119,182,0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.08)';
    }
});

// ===== FORMULARIO DE CONTACTO =====
function enviarFormulario() {
    const nombre = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const plan = document.getElementById('plan').value;
    const mensaje = document.getElementById('mensaje').value;

    if (!nombre || !telefono || !plan) {
        alert('⚠️ Por favor completa los campos obligatorios.');
        return;
    }

    const texto = `Hola MetCommerce! 👋%0A%0A*Negocio:* ${nombre}%0A*Plan de interés:* ${plan}%0A*Mensaje:* ${mensaje}`;
    window.open(`https://wa.me/573042907179?text=${texto}`, '_blank');
}

// ===== ANIMACION AL HACER SCROLL =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.servicio-card, .paso, .precio-card, .stat').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});