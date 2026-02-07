/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#f2b90d",
                "primary-dark": "#b38600",
                "background-light": "#333333",
                "background-dark": "#181611",
                "chassis": "#1c1c1c",
                "chassis-light": "#2a2a2a",
                "brass": "#bfa15f",
                "panel-dark": "#221e10",
                "surface-dark": "#2c281b",
                "gold-metallic": "#d4af37",
            },
            fontFamily: {
                "display": ["Space Grotesk", "sans-serif"],
                "body": ["Noto Sans", "sans-serif"],
            },
            borderRadius: {
                "DEFAULT": "1rem",
                "lg": "2rem",
                "xl": "3rem",
                "full": "9999px"
            },
            boxShadow: {
                'glow': '0 0 15px rgba(242, 185, 13, 0.3)',
                'glow-intense': '0 0 20px rgba(242, 185, 13, 0.6)',
                'recessed': 'inset 2px 2px 5px rgba(0,0,0,0.7), inset -1px -1px 1px rgba(255,255,255,0.05)',
                'knob': '0 4px 6px -1px rgba(0, 0, 0, 0.5), inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)',
                'knob-inner': 'inset 0 4px 6px rgba(0,0,0,0.6)',
                'well': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)',
                'gold-glow': '0 0 10px rgba(242, 185, 13, 0.3)',
                'gold-glow-lg': '0 0 20px rgba(242, 185, 13, 0.15)',
                'plate': 'inset 1px 1px 0 rgba(255,255,255,0.05), 0 4px 8px rgba(0,0,0,0.4)',
            },
            animation: {
                'wave': 'wave 1s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
            },
            keyframes: {
                wave: {
                    '0%': { height: '10%' },
                    '50%': { height: '100%' },
                    '100%': { height: '10%' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 15px rgba(242, 185, 13, 0.3)' },
                    '50%': { boxShadow: '0 0 25px rgba(242, 185, 13, 0.6)' },
                }
            }
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
    ],
}
