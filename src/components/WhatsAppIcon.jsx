/**
 * WhatsApp glyph — the official green bubble, drawn as inline SVG so it needs no
 * asset pipeline and inherits size from props. Used to mark relances the agent
 * sent over WhatsApp and in the channel picker.
 */
export default function WhatsAppIcon({ size = 16, className = '', title = 'WhatsApp' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className}
         role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      <path fill="#25D366" d="M16 0C7.163 0 0 7.163 0 16c0 2.82.74 5.57 2.145 7.995L0 32l8.2-2.147A15.94 15.94 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/>
      <path fill="#FFF" d="M23.94 19.62c-.33-.165-1.95-.963-2.253-1.073-.302-.11-.522-.165-.742.165-.22.33-.852 1.073-1.045 1.293-.192.22-.385.248-.715.083-.33-.165-1.393-.513-2.653-1.637-.98-.874-1.642-1.953-1.834-2.283-.192-.33-.02-.508.145-.673.148-.147.33-.385.495-.577.165-.193.22-.33.33-.55.11-.22.055-.413-.028-.578-.082-.165-.742-1.788-1.017-2.448-.268-.643-.54-.556-.742-.566l-.632-.011c-.22 0-.577.083-.88.413-.302.33-1.155 1.128-1.155 2.75s1.183 3.19 1.348 3.41c.165.22 2.328 3.555 5.64 4.984.788.34 1.403.543 1.883.695.79.251 1.51.216 2.078.131.634-.095 1.95-.797 2.225-1.567.275-.77.275-1.43.192-1.567-.082-.138-.302-.22-.632-.385z"/>
    </svg>
  );
}
