export function About({onGuide}:{onGuide:()=>void}){
 return <section className="about-software" aria-label="关于与版权">
 <div className="about-brand"><img src="./mark.png" alt=""/><div><h3>剧好写</h3><p className="about-tagline">用直觉写作</p><p>0.6.16</p></div></div>
 <button className="secondary" onClick={onGuide}>新手引导</button>
 <h4>作者与版权</h4>
 <p><strong>© 2026 Fu Junhao</strong></p>
 <h4>你的作品</h4><p>剧本、人物设定与 Prompt 等创作内容的权利归其相应权利人所有。</p>
 <h4>第三方组件</h4><p>第三方组件、字体及素材遵循各自许可。完整许可随应用包保留。</p>
</section>}
